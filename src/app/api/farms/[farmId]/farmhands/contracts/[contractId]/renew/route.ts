import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

const renewSchema = z.object({
  newEndDate: z.string().min(8),
  renewalNotes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; contractId: string }> },
) {
  try {
    const { farmId, contractId } = await context.params;
    const auth = await requireFarmPermission(request, farmId, 'setup:write');
    const input = renewSchema.parse(await request.json());
    const data = await farmhandsService.renewContract({
      farmId,
      contractId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
