import { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/errors';
import { controlService } from '@/services/control/control-service';
import { requirePermission } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'digest:read');
    const { farmId } = await context.params;
    const data = await controlService.getWeeklyDigest(farmId);
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
