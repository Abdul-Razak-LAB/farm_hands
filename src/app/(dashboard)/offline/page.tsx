'use client';

import { db } from '@/lib/db';
import { useSyncOrchestrator } from '@/hooks/use-offline-sync';
import { useOutboxStore } from '@/lib/store/outbox';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/utils';
import { ArrowsPointingInIcon, CloudArrowUpIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

export default function OfflineCenter() {
  const { runSync } = useSyncOrchestrator({ autoStart: false });
  const { isSyncing } = useOutboxStore();
  const [isOnline, setIsOnline] = useState(false);

  const { data: outbox } = useQuery({
    queryKey: ['outbox'],
    queryFn: () => db.outbox.orderBy('createdAt').reverse().toArray(),
    refetchInterval: 5000,
  });

  const pendingCount = outbox?.filter((item) => item.status === 'PENDING').length ?? 0;
  const failedCount = outbox?.filter((item) => item.status === 'FAILED').length ?? 0;

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const retryItem = async (id: string) => {
    await db.outbox.update(id, {
      status: 'PENDING',
      retryCount: 0,
      lastError: undefined,
      nextAttemptAt: new Date(),
    });
    await runSync();
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Offline Sync</h1>
          <p className="text-xs text-muted-foreground">Manage pending actions</p>
        </div>
        <button
          onClick={() => runSync()}
          disabled={isSyncing}
          className="bg-primary text-primary-foreground h-10 w-10 flex items-center justify-center rounded-full shadow-lg active:scale-95 disabled:opacity-50"
          title="Sync now"
        >
          <CloudArrowUpIcon className={`h-6 w-6 ${isSyncing ? 'animate-bounce' : ''}`} />
        </button>
      </header>

      <button
        onClick={() => runSync()}
        disabled={isSyncing}
        className="w-full h-10 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold disabled:opacity-50"
      >
        {isSyncing ? 'Syncing...' : 'Sync now'}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Pending Outbox</p>
          <p className="text-xl font-bold">{pendingCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Failed Items</p>
          <p className="text-xl font-bold text-destructive">{failedCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        {outbox?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl border-accent">
            <ArrowsPointingInIcon className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium mt-2">All data synced</p>
          </div>
        )}

        {outbox?.map((item) => (
          <div key={item.id} className="p-3 border rounded-lg flex items-center gap-3 bg-card shadow-sm">
            <div className={`h-2 w-2 rounded-full ${item.status === 'FAILED' ? 'bg-destructive' : 'bg-amber-500 animate-pulse'}`} />
            <div className="flex-1">
              <div className="flex justify-between">
                <p className="text-xs font-bold uppercase tracking-wider">{item.action.replace('_', ' ')}</p>
                <time className="text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</time>
              </div>
              <p className="text-[10px] font-mono opacity-50 truncate max-w-[200px]">{item.id}</p>
              {item.status === 'FAILED' && (
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-1 text-destructive font-medium text-[10px]">
                    <ExclamationTriangleIcon className="h-3 w-3" />
                    {item.lastError || 'Partial sync failure - check connectivity'}
                  </div>
                  <button
                    onClick={() => void retryItem(item.id)}
                    className="h-6 px-2 rounded bg-secondary text-secondary-foreground text-[10px] font-semibold"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-accent/30 p-4 rounded-lg">
        <h3 className="text-xs font-bold uppercase mb-2">Technical Status</h3>
        <dl className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <dt className="text-muted-foreground">Network</dt>
            <dd className="font-bold flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-destructive'}`} />
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Queue Size</dt>
            <dd className="font-bold">{outbox?.length || 0} items</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pending</dt>
            <dd className="font-bold">{pendingCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Failed</dt>
            <dd className="font-bold text-destructive">{failedCount}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
