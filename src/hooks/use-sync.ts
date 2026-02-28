'use client';

import { useSyncOrchestrator } from '@/hooks/use-offline-sync';

export function useSync() {
    const { runSync } = useSyncOrchestrator({ autoStart: true });
    return { syncOutbox: runSync };
}
