import { AppError } from '@/lib/errors';

export async function enqueueDelayedJob(input: {
  url: string;
  payload: Record<string, unknown>;
  delaySeconds?: number;
}) {
  const qstashUrl = process.env.UPSTASH_QSTASH_URL;
  const qstashToken = process.env.UPSTASH_QSTASH_TOKEN;

  if (!qstashUrl || !qstashToken) {
    return { queued: false, skipped: true };
  }

  const response = await fetch(`${qstashUrl}/v2/publish/${encodeURIComponent(input.url)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${qstashToken}`,
      'Content-Type': 'application/json',
      ...(input.delaySeconds ? { 'Upstash-Delay': `${input.delaySeconds}s` } : {}),
    },
    body: JSON.stringify(input.payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError('QSTASH_ENQUEUE_FAILED', 'Failed to enqueue delayed job', 502, { body });
  }

  return { queued: true, skipped: false };
}
