import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { financeService } from '@/services/finance/finance-service';

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; requestId: string }> }
) {
  try {
    requirePermission(request, 'finance:approve');
    const { farmId, requestId } = await context.params;
    const input = decisionSchema.parse(await request.json());
    const userId = getRequestUserId(request);

    const data = await financeService.decideExpense({
      farmId,
      requestId,
      userId,
      decision: input.decision,
      comment: input.comment,
      idempotencyKey: input.idempotencyKey,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
