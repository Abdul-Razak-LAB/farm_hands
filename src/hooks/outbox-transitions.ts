import type { OutboxEntry } from '@/lib/db';

export function toCompletedUpdate() {
  return { status: 'COMPLETED' as const };
}

export function toFailedUpdate(entry: OutboxEntry, error: unknown) {
  return {
    status: 'FAILED' as const,
    retryCount: entry.retryCount + 1,
    lastError: error instanceof Error ? error.message : 'Unknown error',
  };
}

export function toRetryUpdate() {
  return {
    status: 'PENDING' as const,
    retryCount: 0,
    lastError: undefined,
    nextAttemptAt: new Date(),
  };
}
