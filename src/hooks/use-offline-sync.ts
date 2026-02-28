import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db, OutboxEntry } from '@/lib/db';
import { useOutboxStore } from '@/lib/store/outbox';
import { useCallback, useEffect } from 'react';
import { toCompletedUpdate, toFailedUpdate } from './outbox-transitions';

export function useOfflineAction<T>(domain: string, action: string) {
  const queryClient = useQueryClient();
  const setPendingCount = useOutboxStore((state) => state.setPendingCount);

  return useMutation({
    mutationFn: async (payload: T) => {
      const taskId = (payload as { taskId?: string })?.taskId;
      if (typeof taskId === 'string' && taskId.length > 0) {
        const existing = await db.outbox
          .where('status')
          .anyOf(['PENDING', 'FAILED', 'SYNCING'])
          .filter((entry) => (
            entry.domain === domain
            && entry.action === action
            && (entry.payload as { taskId?: string } | undefined)?.taskId === taskId
          ))
          .first();

        if (existing) {
          await db.outbox.update(existing.id, {
            payload,
            status: 'PENDING',
            retryCount: 0,
            lastError: undefined,
            createdAt: new Date(),
          });

          const count = await db.outbox.where('status').equals('PENDING').count();
          setPendingCount(count);
          return { ...existing, payload, status: 'PENDING', retryCount: 0, lastError: undefined } as OutboxEntry;
        }
      }

      const entry: OutboxEntry = {
        id: crypto.randomUUID(),
        domain,
        action,
        payload,
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date(),
      };

      await db.outbox.add(entry);
      
      const count = await db.outbox.where('status').equals('PENDING').count();
      setPendingCount(count);

      // Attempt immediate sync if online
      if (typeof window !== 'undefined' && navigator.onLine) {
        // In a real app, you'd trigger the sync orchestrator here
        console.log('Online: Triggering sync for', entry.id);
      }

      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [domain] });
    },
  });
}

export function useSyncOrchestrator({ autoStart = true }: { autoStart?: boolean } = {}) {
  const setPendingCount = useOutboxStore((state) => state.setPendingCount);
  const setSyncing = useOutboxStore((state) => state.setSyncing);

  const runSync = useCallback(async () => {
    if (useOutboxStore.getState().isSyncing) {
      return;
    }

    const pending = await db.outbox
      .where('status')
      .anyOf(['PENDING', 'FAILED'])
      .toArray();

    if (pending.length === 0) {
      const count = await db.outbox.where('status').equals('PENDING').count();
      setPendingCount(count);
      return;
    }

    setSyncing(true);

    try {
      for (const item of pending) {
        try {
          await db.outbox.update(item.id, { status: 'SYNCING' });

          // Implement exponential backoff check here logic
          // await apiClient.processEvent(item);
          await db.outbox.update(item.id, toCompletedUpdate());
        } catch (error) {
          await db.outbox.update(item.id, toFailedUpdate(item, error));
        }
      }

      const count = await db.outbox.where('status').equals('PENDING').count();
      setPendingCount(count);
    } finally {
      setSyncing(false);
    }
  }, [setPendingCount, setSyncing]);

  useEffect(() => {
    if (!autoStart) return;
    if (typeof window === 'undefined') return;

    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, [autoStart, runSync]);

  return { runSync };
}
