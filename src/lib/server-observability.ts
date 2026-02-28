import { logger } from '@/lib/logger';

type CaptureContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

let sentryInitPromise: Promise<typeof import('@sentry/node') | null> | null = null;

async function getSentry() {
  if (!process.env.SENTRY_DSN) {
    return null;
  }

  if (!sentryInitPromise) {
    sentryInitPromise = import('@sentry/node')
      .then((sentry) => {
        sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV,
        });
        return sentry;
      })
      .catch(() => null);
  }

  return sentryInitPromise;
}

export async function captureServerException(error: unknown, context?: CaptureContext) {
  logger.error('Unhandled server exception', {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    ...context,
  });

  const sentry = await getSentry();
  if (sentry) {
    sentry.withScope((scope) => {
      Object.entries(context?.tags || {}).forEach(([key, value]) => scope.setTag(key, value));
      Object.entries(context?.extra || {}).forEach(([key, value]) => scope.setExtra(key, value));
      sentry.captureException(error);
    });
    return;
  }

  try {
    await fetch(process.env.SENTRY_DSN as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        tags: context?.tags,
        extra: context?.extra,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (captureError) {
    logger.warn('Failed to send server exception to Sentry-compatible endpoint', {
      captureError,
    });
  }
}
