import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const checkRateLimitMock = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

describe('middleware rate limiting', () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset();
  });

  it('returns 429 when auth mutation is rate limited', async () => {
    checkRateLimitMock.mockResolvedValue({
      limited: true,
      retryAfterSeconds: 60,
      limit: 10,
      remaining: 0,
    });

    const { middleware } = await import('./middleware');

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    });

    const response = await middleware(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('RATE_LIMITED');
    expect(response.headers.get('Retry-After')).toBe('60');
  });
});
