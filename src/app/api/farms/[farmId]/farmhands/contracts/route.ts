import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

const createContractSchema = z.object({
  ownerName: z.string().min(2),
  packageName: z.enum(['ESSENTIAL', 'STANDARD', 'ENTERPRISE', 'CUSTOM']),
  serviceTypes: z.array(z.enum([
    'LABOR_SUPPLY',
    'FARM_MANAGER',
    'INPUT_SUPPLY',
    'FIELD_OPERATIONS',
    'MECHANIZATION',
    'CROP_PROTECTION',
  ])).min(1),
  farmSizeHectares: z.number().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    const { farmId } = await context.params;
    await requireFarmPermission(request, farmId, 'setup:read');
    const data = await farmhandsService.listContracts(farmId);
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
    const input = createContractSchema.parse(await request.json());
    const data = await farmhandsService.createContract({
      farmId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
