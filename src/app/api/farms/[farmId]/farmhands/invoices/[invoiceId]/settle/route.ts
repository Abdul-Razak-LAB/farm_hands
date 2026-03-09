import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requireFarmPermission } from '@/lib/permissions';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

const settleSchema = z.object({
  paidAmount: z.number().positive(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CASH']),
  reference: z.string().max(200).optional(),
  idempotencyKey: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; invoiceId: string }> },
) {
  try {
    const { farmId, invoiceId } = await context.params;
    const auth = await requireFarmPermission(request, farmId, 'finance:approve');
    const input = settleSchema.parse(await request.json());
    const data = await farmhandsService.settleInvoice({
      farmId,
      invoiceId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
