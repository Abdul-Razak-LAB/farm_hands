import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { monitoringService } from '@/services/monitoring/monitoring-service';

const feedbackSchema = z.object({
  idempotencyKey: z.string().min(8),
  outcomes: z.array(z.object({
    zoneId: z.string().min(1),
    recommendedYieldPerHa: z.number().positive(),
    actualYieldPerHa: z.number().positive(),
  })).min(1).max(100),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'monitoring:write');
    const { farmId } = await context.params;
    const userId = getRequestUserId(request);
    const input = feedbackSchema.parse(await request.json());

    const data = await monitoringService.recordVraFeedback({
      farmId,
      userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
