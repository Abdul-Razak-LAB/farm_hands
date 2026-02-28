import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { procurementService } from '@/services/procurement/procurement-service';

const deliverySchema = z.object({
  poId: z.string().min(1),
  idempotencyKey: z.string().min(8),
  discrepancyNote: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().min(1),
    qty: z.number().positive(),
  })).min(1).max(100),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'procurement:write');
    const { farmId } = await context.params;
    const body = await request.json();
    const input = deliverySchema.parse(body);
    const userId = getRequestUserId(request);

    const data = await procurementService.confirmDelivery({
      farmId,
      userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
