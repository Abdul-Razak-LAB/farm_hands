import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { consultationService } from '@/services/consultation/consultation-service';

const assignSchema = z.object({
  assigneeName: z.string().optional(),
  assigneeEmail: z.string().email().optional(),
  note: z.string().optional(),
  idempotencyKey: z.string().min(8),
}).refine((input) => Boolean(input.assigneeName || input.assigneeEmail), {
  message: 'Assignee name or email is required',
  path: ['assigneeName'],
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; consultationId: string }> },
) {
  try {
    requirePermission(request, 'incident:write');
    const { farmId, consultationId } = await context.params;
    const userId = getRequestUserId(request);
    const input = assignSchema.parse(await request.json());

    const data = await consultationService.assignExpert({
      farmId,
      userId,
      consultationId,
      assigneeName: input.assigneeName,
      assigneeEmail: input.assigneeEmail,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
