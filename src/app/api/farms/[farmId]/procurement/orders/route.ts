import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
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
    const { farmId } = await context.params;
    await requireFarmPermission(request, farmId, 'procurement:read');
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
    const { farmId } = await context.params;
    const auth = await requireFarmPermission(request, farmId, 'procurement:write');
    const body = await request.json();
    const input = createOrderSchema.parse(body);

    const data = await procurementService.createPurchaseOrder({
      farmId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
