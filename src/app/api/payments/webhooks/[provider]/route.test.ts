import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyWebhookMock = vi.fn();
const infoMock = vi.fn();

vi.mock('@/lib/integrations/payments/gateway', () => ({
  getPaymentGateway: vi.fn(() => ({
    verifyWebhook: (...args: unknown[]) => verifyWebhookMock(...args),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => infoMock(...args),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('payment webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts valid webhook signature', async () => {
    verifyWebhookMock.mockResolvedValue(true);

    const { POST } = await import('./route');
    const request = new Request('http://localhost:3000/api/payments/webhooks/paystack', {
      method: 'POST',
      headers: {
        'x-paystack-signature': 'valid-signature',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ event: 'charge.success' }),
    });

    const response = await POST(request, { params: Promise.resolve({ provider: 'paystack' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.accepted).toBe(true);
    expect(infoMock).toHaveBeenCalled();
  });

  it('rejects invalid webhook signature', async () => {
    verifyWebhookMock.mockResolvedValue(false);

    const { POST } = await import('./route');
    const request = new Request('http://localhost:3000/api/payments/webhooks/hubtel', {
      method: 'POST',
      headers: {
        'x-hubtel-signature': 'bad-signature',
      },
      body: JSON.stringify({ event: 'payment.failed' }),
    });

    const response = await POST(request, { params: Promise.resolve({ provider: 'hubtel' }) });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('rejects unsupported provider', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost:3000/api/payments/webhooks/other', {
      method: 'POST',
      body: '{}',
    });

    const response = await POST(request, { params: Promise.resolve({ provider: 'other' }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('PAYMENT_PROVIDER_UNSUPPORTED');
  });
});
