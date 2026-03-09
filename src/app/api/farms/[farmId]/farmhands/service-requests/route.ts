import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

const requestServiceSchema = z.object({
  contractId: z.string().optional(),
  type: z.enum([
    'LABOR',
    'WORKER_REPLACEMENT',
    'FARM_MANAGER_SUPPORT',
    'INPUT_DELIVERY',
    'SPRAYING',
    'HARVEST_SUPPORT',
  ]),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  neededBy: z.string().optional(),
  headcount: z.number().int().positive().optional(),
  description: z.string().min(5),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    const { farmId } = await context.params;
    await requireFarmPermission(request, farmId, 'setup:read');
    const data = await farmhandsService.listServiceRequests(farmId);
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
    const input = requestServiceSchema.parse(await request.json());
    const data = await farmhandsService.requestService({
      farmId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
