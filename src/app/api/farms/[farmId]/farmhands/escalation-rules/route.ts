import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

const ruleSchema = z.object({
  ruleId: z.string().optional(),
  name: z.string().min(3),
  isActive: z.boolean(),
  maxAssignmentMinutes: z.number().int().positive(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  notifyOwner: z.boolean().default(true),
  notifyManager: z.boolean().default(true),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    const { farmId } = await context.params;
    await requireFarmPermission(request, farmId, 'report:read');
    const data = await farmhandsService.listEscalationRules(farmId);
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
    const { farmId } = await context.params;
    const auth = await requireFarmPermission(request, farmId, 'setup:write');
    const input = ruleSchema.parse(await request.json());
    const data = await farmhandsService.upsertEscalationRule({
      farmId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
