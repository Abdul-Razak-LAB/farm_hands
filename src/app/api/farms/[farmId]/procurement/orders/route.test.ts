import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const listPurchaseOrdersMock = vi.fn();
const createPurchaseOrderMock = vi.fn();

vi.mock('@/services/procurement/procurement-service', () => ({
  procurementService: {
    listPurchaseOrders: (...args: unknown[]) => listPurchaseOrdersMock(...args),
    createPurchaseOrder: (...args: unknown[]) => createPurchaseOrderMock(...args),
  },
}));

describe('procurement orders route permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows WORKER to read procurement orders', async () => {
    listPurchaseOrdersMock.mockResolvedValue([{ id: 'po-1' }]);
    const { GET } = await import('./route');

    const request = new NextRequest('http://localhost:3000/api/farms/farm-1/procurement/orders', {
      method: 'GET',
      headers: {
        'x-farm-role': 'WORKER',
      },
    });

    const response = await GET(request, { params: Promise.resolve({ farmId: 'farm-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([{ id: 'po-1' }]);
    expect(listPurchaseOrdersMock).toHaveBeenCalledWith('farm-1');
  });

  it('blocks WORKER from creating procurement orders', async () => {
    const { POST } = await import('./route');

    const request = new NextRequest('http://localhost:3000/api/farms/farm-1/procurement/orders', {
      method: 'POST',
      headers: {
        'x-farm-role': 'WORKER',
        'x-user-id': 'worker-1',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        vendorId: 'vendor-1',
        idempotencyKey: 'idem-12345678',
        items: [{ description: 'fertilizer', qty: 1, unitPrice: 12 }],
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ farmId: 'farm-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('FORBIDDEN');
    expect(createPurchaseOrderMock).not.toHaveBeenCalled();
  });
});
