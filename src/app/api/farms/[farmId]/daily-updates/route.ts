import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { controlService } from '@/services/control/control-service';
import { getRequestUserId, requirePermission } from '@/lib/permissions';

const createSchema = z.object({
  summary: z.string().min(3),
  blockers: z.string().optional(),
  voiceNoteUrl: z.string().url().optional(),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'updates:read');
    const { farmId } = await context.params;
    const data = await controlService.listDailyUpdates(farmId);
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
    requirePermission(request, 'updates:write');
    const { farmId } = await context.params;
    const input = createSchema.parse(await request.json());
    const userId = getRequestUserId(request);
    const data = await controlService.submitDailyUpdate({ farmId, userId, ...input });
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
