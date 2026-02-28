'use client';

import { useEffect, useState } from 'react';
import { db, type OutboxEntry } from '@/lib/db';
import { useSyncOrchestrator } from '@/hooks/use-offline-sync';
import { cn } from '@/lib/utils';
import {
    CloudArrowUpIcon,
    ExclamationCircleIcon,
    CheckCircleIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

export function OfflineCenter() {
    const { runSync } = useSyncOrchestrator({ autoStart: false });
    const [jobs, setJobs] = useState<OutboxEntry[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    const loadJobs = async () => {
        const data = await db.outbox.orderBy('createdAt').reverse().toArray();
        setJobs(data);
    };

    useEffect(() => {
        loadJobs();
        const interval = setInterval(loadJobs, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleManualSync = async () => {
        setIsSyncing(true);
        await runSync();
        await loadJobs();
        setIsSyncing(false);
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Offline Center</h1>
                <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className={cn(
                        "h-10 w-10 flex items-center justify-center rounded-full bg-accent transition-transform",
                        isSyncing && "animate-spin"
                    )}
                >
                    <ArrowPathIcon className="h-6 w-6" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border rounded-2xl p-4 flex flex-col items-center gap-2">
                    <span className="text-2xl font-bold">{jobs.filter(j => j.status === 'PENDING').length}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Pending</span>
                </div>
                <div className="bg-card border rounded-2xl p-4 flex flex-col items-center gap-2">
                    <span className="text-2xl font-bold text-destructive">{jobs.filter(j => j.status === 'FAILED').length}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Failed</span>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Sync Queue</h3>
                <div className="grid gap-3">
                    {jobs.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-sm">No items in outbox.</p>
                    ) : (
                        jobs.map((job) => (
                            <div key={job.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card text-sm">
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center",
                                    job.status === 'COMPLETED' ? "bg-green-100 text-green-600" :
                                        job.status === 'FAILED' ? "bg-red-100 text-red-600" :
                                            "bg-blue-100 text-blue-600"
                                )}>
                                    {job.status === 'COMPLETED' ? <CheckCircleIcon className="h-5 w-5" /> :
                                        job.status === 'FAILED' ? <ExclamationCircleIcon className="h-5 w-5" /> :
                                            <CloudArrowUpIcon className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{job.action}</p>
                                    <p className="text-xs text-muted-foreground">Retries: {job.retryCount} • {job.status}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
