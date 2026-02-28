import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { incidentService } from '@/services/incident/incident-service';

const schema = z.object({
  issueEventId: z.string().min(1),
  resolution: z.string().min(3),
  idempotencyKey: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'incident:write');
    const { farmId } = await context.params;
    const input = schema.parse(await request.json());
    const userId = getRequestUserId(request);
    const data = await incidentService.resolveIssue({ farmId, userId, ...input });
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
