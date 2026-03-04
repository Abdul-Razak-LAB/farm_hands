import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { consultationService } from '@/services/consultation/consultation-service';

const createSchema = z.object({
  topic: z.string().min(3),
  question: z.string().min(5),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'incident:read');
    const { farmId } = await context.params;
    const data = await consultationService.listConsultations(farmId);
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
    requirePermission(request, 'incident:write');
    const { farmId } = await context.params;
    const userId = getRequestUserId(request);
    const input = createSchema.parse(await request.json());
    const data = await consultationService.requestConsultation({
      farmId,
      userId,
      topic: input.topic,
      question: input.question,
      urgency: input.urgency,
      idempotencyKey: input.idempotencyKey,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
