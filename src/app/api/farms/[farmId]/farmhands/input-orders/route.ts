import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

const placeInputOrderSchema = z.object({
  contractId: z.string().optional(),
  serviceRequestId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    sku: z.string().min(2),
    description: z.string().min(2),
    qty: z.number().positive(),
    unitPrice: z.number().positive(),
  })).min(1).max(30),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    const { farmId } = await context.params;
    await requireFarmPermission(request, farmId, 'procurement:read');
    const data = await farmhandsService.listInputOrders(farmId);
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    const { farmId } = await context.params;
    const auth = await requireFarmPermission(request, farmId, 'procurement:write');
    const input = placeInputOrderSchema.parse(await request.json());
    const data = await farmhandsService.placeInputOrder({
      farmId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
