import { prisma } from '@/lib/prisma';

const RETRYABLE_CODES = new Set(['P2034', 'DB_SERIALIZATION_CONFLICT', 'TIMEOUT']);

function toRetryableCode(error: unknown) {
  const anyError = error as { code?: string };
  return anyError?.code;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSerializableTransactionWithRetry<T>(
  operation: (tx: any) => Promise<T>,
  maxAttempts = 3,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      lastError = error;
      const code = toRetryableCode(error);
      const shouldRetry = Boolean(code && RETRYABLE_CODES.has(code)) && attempt < maxAttempts;
      if (!shouldRetry) {
        throw error;
      }

      await delay(20 * attempt);
    }
  }

  throw lastError;
}
