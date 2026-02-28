import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { monitoringService } from '@/services/monitoring/monitoring-service';

const resolveSchema = z.object({
  idempotencyKey: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; alertId: string }> }
) {
  try {
    requirePermission(request, 'monitoring:write');
    const { farmId, alertId } = await context.params;
    const input = resolveSchema.parse(await request.json());
    const userId = getRequestUserId(request);
    const data = await monitoringService.resolveAlert({
      farmId,
      alertId,
      userId,
      idempotencyKey: input.idempotencyKey,
    });
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
