export type IntegrationName = 'upload' | 'email' | 'push';

type CaptureContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

type GlobalSentryLike = {
  captureException?: (error: unknown, context?: CaptureContext) => void;
  captureMessage?: (message: string, context?: CaptureContext) => void;
};

function getSentryGlobal(): GlobalSentryLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const candidate = (window as Window & { Sentry?: GlobalSentryLike }).Sentry;
  return candidate ?? null;
}

export function captureAppException(error: unknown, context?: CaptureContext) {
  const sentry = getSentryGlobal();
  sentry?.captureException?.(error, context);
  console.error(error);
}

export function captureAppMessage(message: string, context?: CaptureContext) {
  const sentry = getSentryGlobal();
  sentry?.captureMessage?.(message, context);
  console.warn(message);
}

export function reportIntegrationDegraded(integration: IntegrationName, reason: string) {
  captureAppMessage(`Integration degraded: ${integration}`, {
    tags: { integration },
    extra: { reason },
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('farmops:integration-degraded', {
      detail: { integration, reason },
    }));
  }
}
