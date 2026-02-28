import { z } from 'zod';
import { AppError, createErrorResponse } from '@/lib/errors';
import { getPaymentGateway } from '@/lib/integrations/payments/gateway';

const schema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  reference: z.string().min(3),
  customerEmail: z.string().email().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await context.params;
    if (provider !== 'paystack' && provider !== 'hubtel') {
      throw new AppError('PAYMENT_PROVIDER_UNSUPPORTED', 'Unsupported payment provider', 400);
    }

    const input = schema.parse(await request.json());
    const gateway = getPaymentGateway(provider);
    const data = await gateway.initializePayment(input);

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
