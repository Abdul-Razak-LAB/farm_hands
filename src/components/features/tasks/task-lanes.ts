import type { LocalTask } from '@/lib/db';

export type TaskLanes = {
  TODAY: LocalTask[];
  OVERDUE: LocalTask[];
  COMPLETED: LocalTask[];
};

export function partitionTaskLanes(tasks: LocalTask[] | undefined, nowMs = Date.now()): TaskLanes {
  const items = tasks ?? [];

  return {
    TODAY: items.filter((task) => task.status !== 'COMPLETED' && new Date(task.dueDate).getTime() >= nowMs),
    OVERDUE: items.filter((task) => task.status !== 'COMPLETED' && new Date(task.dueDate).getTime() < nowMs),
    COMPLETED: items.filter((task) => task.status === 'COMPLETED'),
  };
}
