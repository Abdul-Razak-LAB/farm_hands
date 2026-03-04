import type { OutboxEntry } from '@/lib/db';

const BASE_BACKOFF_MS = 1_500;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export function toCompletedUpdate() {
  return { status: 'COMPLETED' as const };
}

export function toFailedUpdate(entry: OutboxEntry, error: unknown) {
  const retryCount = entry.retryCount + 1;
  const exponentialDelay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** Math.max(0, retryCount - 1)));
  const jitter = Math.floor(Math.random() * 500);

  return {
    status: 'FAILED' as const,
    retryCount,
    lastError: error instanceof Error ? error.message : 'Unknown error',
    nextAttemptAt: new Date(Date.now() + exponentialDelay + jitter),
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
