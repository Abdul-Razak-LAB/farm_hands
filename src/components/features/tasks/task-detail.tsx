'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db, type LocalTask } from '@/lib/db';
import { ProofCapture } from './proof-capture';
import { ChevronLeftIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useOfflineAction } from '@/hooks/use-offline-sync';

export function TaskDetail() {
    const { taskId } = useParams();
    const router = useRouter();
    const [task, setTask] = useState<LocalTask | null>(null);
    const { mutateAsync: queueTaskStatus } = useOfflineAction<{ taskId: string; status: string }>('tasks', 'TASK_STATUS_UPDATED');

    useEffect(() => {
        const load = async () => {
            const found = await db.local_tasks.get(taskId as string);
            if (found) setTask(found);
        };
        void load();
    }, [taskId]);

    const markCompleted = async () => {
        if (!task) return;
        if (task.status === 'COMPLETED') return;

        await db.local_tasks.update(task.id, { status: 'COMPLETED' });
        await queueTaskStatus({ taskId: task.id, status: 'COMPLETED' });

        const refreshed = await db.local_tasks.get(task.id);
        setTask(refreshed ?? null);
    };

    if (!task) return <div className="p-8 text-center">Loading task...</div>;

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="h-10 w-10 flex items-center justify-center rounded-full bg-accent">
                    <ChevronLeftIcon className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-bold flex-1 truncate">{task.title}</h1>
            </div>

            <div className="bg-card rounded-2xl p-4 border space-y-4">
                <div className="flex items-center gap-3 text-muted-foreground text-sm">
                    <CalendarIcon className="h-4 w-4" />
                    <span>Due {task.dueDate ? new Date(task.dueDate).toLocaleString() : 'ASAP'}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground text-sm">
                    <MapPinIcon className="h-4 w-4" />
                    <span>Section 4 - North Field</span>
                </div>
                <div className="prose prose-sm dark:prose-invert">
                    <p>{String(task.data?.notes || 'No description provided.')}</p>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Proof of Work</h3>
                <ProofCapture taskId={task.id} onComplete={() => {
                    void markCompleted();
                }} />
            </div>

            <button
                onClick={() => void markCompleted()}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all"
            >
                Mark as Finished
            </button>
        </div>
    );
}
