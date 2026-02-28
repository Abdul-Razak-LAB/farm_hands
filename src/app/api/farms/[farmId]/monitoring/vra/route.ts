import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { monitoringService } from '@/services/monitoring/monitoring-service';

const zoneSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(1),
  hectares: z.number().positive(),
  productivityIndex: z.number().min(0).max(1),
});

const createSchema = z.object({
  zones: z.array(zoneSchema).min(1).max(50),
  market: z.object({
    commodityPricePerTon: z.number().positive(),
    seedCostPerKg: z.number().positive(),
    fertilizerCostPerKg: z.number().positive(),
    targetMarginPerHa: z.number().positive(),
  }),
  intelligence: z.object({
    weatherRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    pestPressure: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    maxYieldPotentialTonsPerHa: z.number().positive(),
  }),
  idempotencyKey: z.string().min(8),
});

const sampleRequest = {
  zones: [
    { zoneId: 'z1', name: 'North Ridge', hectares: 12, productivityIndex: 0.34 },
    { zoneId: 'z2', name: 'Central Flat', hectares: 18, productivityIndex: 0.61 },
    { zoneId: 'z3', name: 'South Valley', hectares: 10, productivityIndex: 0.82 },
  ],
  market: {
    commodityPricePerTon: 360,
    seedCostPerKg: 2.6,
    fertilizerCostPerKg: 0.95,
    targetMarginPerHa: 420,
  },
  intelligence: {
    weatherRisk: 'MEDIUM' as const,
    pestPressure: 'LOW' as const,
    maxYieldPotentialTonsPerHa: 6.2,
  },
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'monitoring:read');
    const { farmId } = await context.params;
    const userId = getRequestUserId(request);

    const data = await monitoringService.generateVraPlan({
      farmId,
      userId,
      idempotencyKey: `sample-${new Date().toISOString().slice(0, 10)}`,
      ...sampleRequest,
    });

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
    requirePermission(request, 'monitoring:write');
    const { farmId } = await context.params;
    const userId = getRequestUserId(request);
    const input = createSchema.parse(await request.json());

    const data = await monitoringService.generateVraPlan({
      farmId,
      userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
