import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRawMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
  },
}));

describe('health route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    queryRawMock.mockReset();
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_URL;
    delete process.env.UPSTASH_REDIS_TOKEN;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY;
    delete process.env.CLOUDFLARE_R2_SECRET_KEY;
    delete process.env.CLOUDFLARE_R2_BUCKET;
    delete process.env.RESEND_API_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.HUBTEL_CLIENT_ID;
    delete process.env.HUBTEL_CLIENT_SECRET;
    delete process.env.UPSTASH_QSTASH_URL;
    delete process.env.UPSTASH_QSTASH_TOKEN;
    delete process.env.SENTRY_DSN;
  });

  it('returns degraded when optional integrations are not configured', async () => {
    queryRawMock.mockResolvedValue([1]);
    vi.stubGlobal('fetch', vi.fn());

    const { GET } = await import('./route');
    const response = await GET();
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('degraded');
    expect(payload.data.checks.db.ok).toBe(true);
    expect(payload.data.checks.redis.ok).toBe(false);
  });

  it('returns ok when all checks pass', async () => {
    process.env.UPSTASH_REDIS_URL = 'https://example-redis.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'token';
    process.env.CLOUDFLARE_R2_ACCESS_KEY = 'r2-key';
    process.env.CLOUDFLARE_R2_SECRET_KEY = 'r2-secret';
    process.env.CLOUDFLARE_R2_BUCKET = 'bucket';
    process.env.RESEND_API_KEY = 'resend';
    process.env.VAPID_PUBLIC_KEY = 'vapid-public';
    process.env.VAPID_PRIVATE_KEY = 'vapid-private';
    process.env.PAYSTACK_SECRET_KEY = 'paystack';
    process.env.UPSTASH_QSTASH_URL = 'https://qstash.upstash.io';
    process.env.UPSTASH_QSTASH_TOKEN = 'qstash-token';
    process.env.SENTRY_DSN = 'https://example.ingest.sentry.io/1';

    queryRawMock.mockResolvedValue([1]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    const { GET } = await import('./route');
    const response = await GET();
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('ok');
    expect(payload.data.checks.db.ok).toBe(true);
    expect(payload.data.checks.redis.ok).toBe(true);
    expect(payload.data.checks.storage.ok).toBe(true);
    expect(payload.data.checks.email.ok).toBe(true);
    expect(payload.data.checks.push.ok).toBe(true);
    expect(payload.data.checks.payments.ok).toBe(true);
    expect(payload.data.checks.qstash.ok).toBe(true);
    expect(payload.data.checks.sentry.ok).toBe(true);
  });
});
