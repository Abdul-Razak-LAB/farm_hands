import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { procurementService } from '@/services/procurement/procurement-service';

const requestSchema = z.object({
  reason: z.string().min(3),
  vendorId: z.string().optional(),
  amount: z.number().positive(),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    const { farmId } = await context.params;
    await requireFarmPermission(request, farmId, 'procurement:read');
    const data = await procurementService.listPurchaseRequests(farmId);
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
    const input = requestSchema.parse(body);

    const data = await procurementService.requestPurchase({
      farmId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
