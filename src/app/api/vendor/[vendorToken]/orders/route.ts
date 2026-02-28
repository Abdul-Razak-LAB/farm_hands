import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse, AppError } from '@/lib/errors';
import { vendorService } from '@/services/vendor/vendor-service';

const confirmSchema = z.object({
  poId: z.string().min(1),
  invoiceNumber: z.string().min(3),
  evidenceUrl: z.string().url().optional(),
  idempotencyKey: z.string().min(8),
});

function resolveFarmIdFromToken(vendorToken: string) {
  if (!vendorToken || vendorToken.trim().length < 3) {
    throw new AppError('INVALID_TOKEN', 'Invalid vendor token', 400);
  }

  // Current shared-workflow token format: plain farmId.
  return vendorToken;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ vendorToken: string }> }
) {
  try {
    const { vendorToken } = await context.params;
    const farmId = resolveFarmIdFromToken(vendorToken);
    const data = await vendorService.listOrders(farmId);
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorToken: string }> }
) {
  try {
    const { vendorToken } = await context.params;
    const farmId = resolveFarmIdFromToken(vendorToken);
    const input = confirmSchema.parse(await request.json());

    const data = await vendorService.confirmOrder({
      farmId,
      userId: `vendor-token:${vendorToken.slice(0, 12)}`,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
