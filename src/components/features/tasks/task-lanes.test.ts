import { describe, expect, it } from 'vitest';
import { partitionTaskLanes } from './task-lanes';
import type { LocalTask } from '@/lib/db';

describe('task lane partitioning', () => {
  it('partitions tasks into today, overdue, and completed lanes', () => {
    const now = new Date('2026-02-25T10:00:00.000Z');

    const tasks: LocalTask[] = [
      {
        id: 't1',
        farmId: 'farm-1',
        title: 'Future task',
        status: 'IN_PROGRESS',
        dueDate: new Date('2026-02-25T12:00:00.000Z'),
        data: {},
      },
      {
        id: 't2',
        farmId: 'farm-1',
        title: 'Past due task',
        status: 'TODO',
        dueDate: new Date('2026-02-25T08:00:00.000Z'),
        data: {},
      },
      {
        id: 't3',
        farmId: 'farm-1',
        title: 'Done task',
        status: 'COMPLETED',
        dueDate: new Date('2026-02-25T07:00:00.000Z'),
        data: {},
      },
    ];

    const lanes = partitionTaskLanes(tasks, now.getTime());

    expect(lanes.TODAY.map((task) => task.id)).toEqual(['t1']);
    expect(lanes.OVERDUE.map((task) => task.id)).toEqual(['t2']);
    expect(lanes.COMPLETED.map((task) => task.id)).toEqual(['t3']);
  });
});
