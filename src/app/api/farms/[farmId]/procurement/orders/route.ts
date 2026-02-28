import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { procurementService } from '@/services/procurement/procurement-service';

const createOrderSchema = z.object({
  vendorId: z.string().min(1),
  idempotencyKey: z.string().min(8),
  items: z.array(z.object({
    description: z.string().min(2),
    qty: z.number().positive(),
    unitPrice: z.number().positive(),
  })).min(1).max(20),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'procurement:read');
    const { farmId } = await context.params;
    const data = await procurementService.listPurchaseOrders(farmId);
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'procurement:write');
    const { farmId } = await context.params;
    const body = await request.json();
    const input = createOrderSchema.parse(body);
    const userId = getRequestUserId(request);

    const data = await procurementService.createPurchaseOrder({
      farmId,
      userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
