import { db, type LocalTask } from '@/lib/db';
import { useAuth } from '@/components/layout/auth-provider';

export function useTaskClient() {
    const { farmId } = useAuth();

    const getTasks = async () => {
        if (!farmId) return [];
        return db.local_tasks.where('farmId').equals(farmId).toArray();
    };

    const createTask = async (task: Omit<LocalTask, 'id' | 'farmId'>) => {
        if (!farmId) return;

        const id = `local_${Date.now()}`;
        const newTask: LocalTask = {
            ...task,
            id,
            farmId,
        };

        await db.local_tasks.add(newTask);

        // Queue job for sync
        await db.outbox.add({
            id: crypto.randomUUID(),
            domain: 'tasks',
            action: 'TASK_CREATE',
            payload: newTask,
            status: 'PENDING',
            retryCount: 0,
            createdAt: new Date(),
        });

        return newTask;
    };

    const updateTask = async (id: string, updates: Partial<LocalTask>) => {
        if (!farmId) return;

        await db.local_tasks.update(id, updates);

        await db.outbox.add({
            id: crypto.randomUUID(),
            domain: 'tasks',
            action: 'TASK_UPDATE',
            payload: { id, ...updates, farmId },
            status: 'PENDING',
            retryCount: 0,
            createdAt: new Date(),
        });
    };

    return { getTasks, createTask, updateTask };
}
