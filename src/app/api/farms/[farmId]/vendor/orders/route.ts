import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { vendorService } from '@/services/vendor/vendor-service';

const confirmSchema = z.object({
  poId: z.string().min(1),
  invoiceNumber: z.string().min(3),
  evidenceUrl: z.string().url().optional(),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'vendor:read');
    const { farmId } = await context.params;
    const data = await vendorService.listOrders(farmId);
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
    requirePermission(request, 'vendor:write');
    const { farmId } = await context.params;
    const input = confirmSchema.parse(await request.json());
    const userId = getRequestUserId(request);
    const data = await vendorService.confirmOrder({ farmId, userId, ...input });
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
