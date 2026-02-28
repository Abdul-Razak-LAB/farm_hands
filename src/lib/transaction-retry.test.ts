import { describe, expect, it, vi, beforeEach } from 'vitest';

const transactionMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

describe('runSerializableTransactionWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries on serialization conflicts and eventually succeeds', async () => {
    const retryError = Object.assign(new Error('conflict'), { code: 'P2034' });
    transactionMock
      .mockRejectedValueOnce(retryError)
      .mockResolvedValueOnce({ ok: true });

    const { runSerializableTransactionWithRetry } = await import('./transaction-retry');
    const result = await runSerializableTransactionWithRetry(async () => ({ ok: true }));

    expect(result).toEqual({ ok: true });
    expect(transactionMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const nonRetryable = Object.assign(new Error('validation'), { code: 'P2002' });
    transactionMock.mockRejectedValueOnce(nonRetryable);

    const { runSerializableTransactionWithRetry } = await import('./transaction-retry');
    await expect(runSerializableTransactionWithRetry(async () => ({ ok: true }))).rejects.toBe(nonRetryable);

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
