import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { payrollService } from '@/services/payroll/payroll-service';

const approveSchema = z.object({
  idempotencyKey: z.string().min(8),
  comment: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; runId: string }> }
) {
  try {
    requirePermission(request, 'payroll:approve');
    const { farmId, runId } = await context.params;
    const body = await request.json();
    const input = approveSchema.parse(body);
    const userId = getRequestUserId(request);

    const data = await payrollService.approveRun({
      farmId,
      runId,
      userId,
      idempotencyKey: input.idempotencyKey,
      comment: input.comment,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
