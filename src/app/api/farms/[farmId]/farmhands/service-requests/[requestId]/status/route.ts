import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

const statusSchema = z.object({
  status: z.enum(['PENDING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; requestId: string }> },
) {
  try {
    const { farmId, requestId } = await context.params;
    const auth = await requireFarmPermission(request, farmId, 'setup:write');
    const input = statusSchema.parse(await request.json());
    const data = await farmhandsService.updateServiceRequestStatus({
      farmId,
      requestId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
