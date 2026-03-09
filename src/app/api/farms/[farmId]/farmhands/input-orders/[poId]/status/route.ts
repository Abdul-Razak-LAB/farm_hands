import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

const statusSchema = z.object({
  status: z.enum(['ISSUED', 'DELIVERED', 'RECONCILED', 'CANCELLED']),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; poId: string }> },
) {
  try {
    const { farmId, poId } = await context.params;
    const auth = await requireFarmPermission(request, farmId, 'procurement:write');
    const input = statusSchema.parse(await request.json());
    const data = await farmhandsService.updateInputOrderStatus({
      farmId,
      poId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
