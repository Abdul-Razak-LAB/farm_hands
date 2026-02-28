import { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/errors';
import { requirePermission } from '@/lib/permissions';
import { financeService } from '@/services/finance/finance-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'finance:read');
    const { farmId } = await context.params;
    const data = await financeService.listBudgets(farmId);
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
