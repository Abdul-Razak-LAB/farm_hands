import { afterEach, describe, expect, it } from 'vitest';

describe('media-integrity job route', () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it('rejects requests with invalid job secret', async () => {
    process.env.CRON_SECRET = 'valid-secret';
    const { POST } = await import('./route');

    const request = new Request('http://localhost:3000/api/jobs/media-integrity', {
      method: 'POST',
      headers: {
        'x-job-secret': 'invalid-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        farmId: 'farm-1',
        fileUrl: '/uploads/farm-1/a.jpg',
        checksum: 'abc',
        contentType: 'image/jpeg',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('UNAUTHORIZED_JOB');
  });

  it('accepts requests with valid job secret', async () => {
    process.env.CRON_SECRET = 'valid-secret';
    const { POST } = await import('./route');

    const request = new Request('http://localhost:3000/api/jobs/media-integrity', {
      method: 'POST',
      headers: {
        'x-job-secret': 'valid-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        farmId: 'farm-1',
        fileUrl: '/uploads/farm-1/a.jpg',
        checksum: 'abc',
        contentType: 'image/jpeg',
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.processed).toBe(true);
  });
});
