import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { payrollService } from '@/services/payroll/payroll-service';

const createRunSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  idempotencyKey: z.string().min(8),
  entries: z.array(z.object({
    userId: z.string().min(1),
    grossAmount: z.number().positive(),
    netAmount: z.number().positive(),
  })).min(1).max(500),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    const { farmId } = await context.params;
    await requireFarmPermission(request, farmId, 'payroll:read');
    const data = await payrollService.listRuns(farmId);
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
    const auth = await requireFarmPermission(request, farmId, 'payroll:write');
    const body = await request.json();
    const input = createRunSchema.parse(body);

    const data = await payrollService.createRun({
      farmId,
      userId: auth.userId,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      entries: input.entries,
      idempotencyKey: input.idempotencyKey,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
