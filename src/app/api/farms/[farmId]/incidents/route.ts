import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { incidentService } from '@/services/incident/incident-service';

const reportSchema = z.object({
  title: z.string().min(3),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  details: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'incident:read');
    const { farmId } = await context.params;
    const data = await incidentService.getTimeline(farmId);
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
    requirePermission(request, 'incident:write');
    const { farmId } = await context.params;
    const input = reportSchema.parse(await request.json());
    const userId = getRequestUserId(request);
    const data = await incidentService.reportIssue({ farmId, userId, ...input });
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
