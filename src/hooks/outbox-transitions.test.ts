import { describe, expect, it } from 'vitest';
import { toCompletedUpdate, toFailedUpdate, toRetryUpdate } from './outbox-transitions';
import type { OutboxEntry } from '@/lib/db';

describe('outbox transitions', () => {
  const baseEntry: OutboxEntry = {
    id: 'entry-1',
    domain: 'tasks',
    action: 'TASK_COMPLETED',
    payload: { taskId: 't-1' },
    status: 'PENDING',
    retryCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('transitions PENDING -> COMPLETED', () => {
    const update = toCompletedUpdate();
    expect(update.status).toBe('COMPLETED');
  });

  it('transitions PENDING -> FAILED and increments retry count', () => {
    const update = toFailedUpdate(baseEntry, new Error('network failure'));

    expect(update.status).toBe('FAILED');
    expect(update.retryCount).toBe(1);
    expect(update.lastError).toBe('network failure');
  });

  it('provides retry path update from FAILED -> PENDING', () => {
    const update = toRetryUpdate();

    expect(update.status).toBe('PENDING');
    expect(update.retryCount).toBe(0);
    expect(update.lastError).toBeUndefined();
    expect(update.nextAttemptAt).toBeInstanceOf(Date);
  });
});
