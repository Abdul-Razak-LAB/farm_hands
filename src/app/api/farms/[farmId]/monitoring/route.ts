import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { monitoringService } from '@/services/monitoring/monitoring-service';

const triggerSchema = z.object({
  level: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  message: z.string().min(3),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'monitoring:read');
    const { farmId } = await context.params;
    const data = await monitoringService.getDashboard(farmId);
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
    requirePermission(request, 'monitoring:write');
    const { farmId } = await context.params;
    const input = triggerSchema.parse(await request.json());
    const userId = getRequestUserId(request);
    const data = await monitoringService.triggerAlert({ farmId, userId, ...input });
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
