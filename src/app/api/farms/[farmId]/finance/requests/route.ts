import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { financeService } from '@/services/finance/finance-service';

const createSpendRequestSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(2),
  description: z.string().min(5),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'finance:read');
    const { farmId } = await context.params;
    const data = await financeService.listSpendRequests(farmId);
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
    requirePermission(request, 'finance:write');
    const { farmId } = await context.params;
    const input = createSpendRequestSchema.parse(await request.json());
    const userId = getRequestUserId(request);
    const data = await financeService.requestExpense({
      farmId,
      userId,
      ...input,
    });
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
