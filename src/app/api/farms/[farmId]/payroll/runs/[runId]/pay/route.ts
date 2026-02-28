import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { payrollService } from '@/services/payroll/payroll-service';

const paySchema = z.object({
  idempotencyKey: z.string().min(8),
  reference: z.string().min(3),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; runId: string }> }
) {
  try {
    requirePermission(request, 'payroll:pay');
    const { farmId, runId } = await context.params;
    const body = await request.json();
    const input = paySchema.parse(body);
    const userId = getRequestUserId(request);

    const data = await payrollService.markPaid({
      farmId,
      runId,
      userId,
      idempotencyKey: input.idempotencyKey,
      reference: input.reference,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
