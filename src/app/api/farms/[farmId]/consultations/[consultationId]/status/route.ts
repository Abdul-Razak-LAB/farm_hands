import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { consultationService } from '@/services/consultation/consultation-service';

const statusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']),
  note: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; consultationId: string }> },
) {
  try {
    requirePermission(request, 'incident:write');
    const { farmId, consultationId } = await context.params;
    const userId = getRequestUserId(request);
    const input = statusSchema.parse(await request.json());

    const data = await consultationService.updateStatus({
      farmId,
      userId,
      consultationId,
      status: input.status,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
