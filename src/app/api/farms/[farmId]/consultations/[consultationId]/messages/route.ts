import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestRole, getRequestUserId, requirePermission } from '@/lib/permissions';
import { consultationService } from '@/services/consultation/consultation-service';

const sendMessageSchema = z.object({
  text: z.string().min(1),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; consultationId: string }> },
) {
  try {
    requirePermission(request, 'incident:read');
    const { farmId, consultationId } = await context.params;
    const data = await consultationService.listMessages(farmId, consultationId);
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; consultationId: string }> },
) {
  try {
    requirePermission(request, 'incident:write');
    const { farmId, consultationId } = await context.params;
    const userId = getRequestUserId(request);
    const input = sendMessageSchema.parse(await request.json());
    const role = getRequestRole(request);
    const sender = role === 'WORKER' ? 'FARMER' : 'EXPERT';

    const data = await consultationService.sendMessage({
      farmId,
      userId,
      consultationId,
      text: input.text,
      sender,
      idempotencyKey: input.idempotencyKey,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
