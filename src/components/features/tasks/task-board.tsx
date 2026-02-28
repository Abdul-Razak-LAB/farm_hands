'use client';

import { useEffect, useState } from 'react';
import { useTaskClient } from '@/services/task/task-client';
import { type LocalTask } from '@/lib/db';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { PlusIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export function TaskBoard() {
    const { getTasks, updateTask } = useTaskClient();
    const [tasks, setTasks] = useState<LocalTask[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');

    useEffect(() => {
        const load = async () => {
            const data = await getTasks();
            setTasks(data);
        };
        load();

        // Subscribe to changes in a real app (Dexie has live queries)
    }, [getTasks]);

    const toggleComplete = async (task: LocalTask) => {
        const newStatus = task.status === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';
        await updateTask(task.id, { status: newStatus });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    };

    const filteredTasks = tasks.filter(t => {
        if (filter === 'ALL') return true;
        return t.status === filter;
    });

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Today's Tasks</h1>
                <button className="h-10 w-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <PlusIcon className="h-6 w-6" />
                </button>
            </div>

            <div className="flex gap-2">
                {['ALL', 'IN_PROGRESS', 'COMPLETED'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                            filter === f ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="grid gap-3">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl border-muted">
                        <p className="text-muted-foreground">No tasks found for today.</p>
                    </div>
                ) : (
                    filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            className="group relative flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-all shadow-sm"
                        >
                            <button
                                onClick={() => toggleComplete(task)}
                                className={cn(
                                    "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                    task.status === 'COMPLETED'
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground hover:border-primary"
                                )}
                            >
                                {task.status === 'COMPLETED' && <CheckCircleIcon className="h-5 w-5" />}
                            </button>

                            <Link href={`/tasks/${task.id}`} className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        "font-semibold truncate",
                                        task.status === 'COMPLETED' && "line-through text-muted-foreground"
                                    )}>
                                        {task.title}
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-muted-foreground">
                                        <ClockIcon className="h-3 w-3" />
                                        {task.dueDate ? new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground truncate">{String(task.data?.notes || '')}</p>
                            </Link>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
