import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

const createInvoiceSchema = z.object({
  referenceType: z.enum(['CONTRACT', 'SERVICE_REQUEST', 'INPUT_ORDER']),
  referenceId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(3).max(8).optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    const { farmId } = await context.params;
    await requireFarmPermission(request, farmId, 'finance:read');
    const data = await farmhandsService.listInvoices(farmId);
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
    const auth = await requireFarmPermission(request, farmId, 'finance:write');
    const input = createInvoiceSchema.parse(await request.json());
    const data = await farmhandsService.createInvoice({
      farmId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
