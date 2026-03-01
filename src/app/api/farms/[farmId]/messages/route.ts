import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { collabService } from '@/services/collab/collab-service';

const messageSchema = z.object({
  threadId: z.string().optional(),
  text: z.string().min(1),
  attachments: z.array(z.object({
    fileUrl: z.string().url(),
    fileName: z.string().optional(),
    contentType: z.string().optional(),
    size: z.number().optional(),
  })).default([]),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'message:read');
    const { farmId } = await context.params;
    const limit = Number(request.nextUrl.searchParams.get('limit') || 100);
    const data = await collabService.listMessages(farmId, Math.min(limit, 200));
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'message:write');
    const { farmId } = await context.params;
    const userId = getRequestUserId(request);
    const input = messageSchema.parse(await request.json());

    const data = await collabService.sendMessage({
      farmId,
      userId,
      idempotencyKey: input.idempotencyKey,
      text: input.text,
      threadId: input.threadId,
      attachments: input.attachments,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
