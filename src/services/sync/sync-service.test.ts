import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  task: { findMany: vi.fn() },
  spendRequest: { findMany: vi.fn() },
  inventoryItem: { findMany: vi.fn() },
  tombstone: { findMany: vi.fn() },
  outboxReceipt: { upsert: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('sync service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated incremental delta with tombstones and hasMore', async () => {
    const now = new Date('2026-02-20T10:00:00.000Z');

    prismaMock.task.findMany.mockResolvedValue([
      { id: 't1', updatedAt: new Date('2026-02-20T10:01:00.000Z') },
      { id: 't2', updatedAt: new Date('2026-02-20T10:02:00.000Z') },
    ]);
    prismaMock.spendRequest.findMany.mockResolvedValue([
      { id: 's1', createdAt: new Date('2026-02-20T10:03:00.000Z') },
    ]);
    prismaMock.inventoryItem.findMany.mockResolvedValue([
      { id: 'i1', updatedAt: new Date('2026-02-20T10:04:00.000Z') },
    ]);
    prismaMock.tombstone.findMany.mockResolvedValue([
      { id: 'd1', deletedAt: new Date('2026-02-20T10:05:00.000Z') },
    ]);

    const { syncService } = await import('./sync-service');
    const data = await syncService.getIncrementalDelta('farm-1', now.toISOString(), 2);

    expect(data.records.tasks).toHaveLength(2);
    expect(data.tombstones).toHaveLength(1);
    expect(data.hasMore).toBe(true);
    expect(data.nextCursor).toBe('2026-02-20T10:05:00.000Z');
  });

  it('records outbox receipt statuses per event processing result', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn({
      event: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
      },
      spendRequest: {
        create: vi.fn().mockResolvedValue({ id: 'spend-1' }),
      },
    }));

    const { syncService } = await import('./sync-service');
    const results = await syncService.processBatch('farm-1', [
      {
        type: 'EXPENSE_REQUESTED',
        payload: { amount: 10, category: 'feed', description: 'feed purchase' },
        idempotencyKey: 'idem-ok',
        userId: 'user-1',
        deviceId: 'device-1',
      },
      {
        type: 'UNKNOWN_EVENT',
        payload: {},
        idempotencyKey: 'idem-fail',
        userId: 'user-1',
        deviceId: 'device-1',
      },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBeDefined();
    expect(results[1].error?.code).toBe('UNKNOWN_EVENT_TYPE');
    expect(prismaMock.outboxReceipt.upsert).toHaveBeenCalledTimes(2);
  });

  it('classifies retryable vs permanent sync errors correctly', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => fn({
      event: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: any) => {
          if (data.type === 'FAIL_INTERNAL') {
            const error = new Error('internal fail') as Error & { code?: string };
            error.code = 'INTERNAL_ERROR';
            throw error;
          }

          if (data.type === 'FAIL_DB_CONFLICT') {
            const error = new Error('serialization conflict') as Error & { code?: string };
            error.code = 'DB_SERIALIZATION_CONFLICT';
            throw error;
          }

          return { id: 'event-ok' };
        }),
      },
      spendRequest: {
        create: vi.fn().mockResolvedValue({ id: 'spend-1' }),
      },
    }));

    const { syncService } = await import('./sync-service');
    const results = await syncService.processBatch('farm-1', [
      {
        type: 'FAIL_INTERNAL',
        payload: {},
        idempotencyKey: 'idem-internal',
        userId: 'user-1',
      },
      {
        type: 'FAIL_DB_CONFLICT',
        payload: {},
        idempotencyKey: 'idem-db-conflict',
        userId: 'user-1',
      },
      {
        type: 'UNKNOWN_EVENT',
        payload: {},
        idempotencyKey: 'idem-unknown',
        userId: 'user-1',
      },
    ]);

    const byKey = Object.fromEntries(results.map((result: any) => [result.idempotencyKey, result]));

    expect(byKey['idem-internal'].success).toBe(false);
    expect(byKey['idem-internal'].retryable).toBe(true);

    expect(byKey['idem-db-conflict'].success).toBe(false);
    expect(byKey['idem-db-conflict'].retryable).toBe(true);

    expect(byKey['idem-unknown'].success).toBe(false);
    expect(byKey['idem-unknown'].error.code).toBe('UNKNOWN_EVENT_TYPE');
    expect(byKey['idem-unknown'].retryable).toBe(false);
  });
});
