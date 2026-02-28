import { AppError, createErrorResponse } from '@/lib/errors';
import { getPaymentGateway } from '@/lib/integrations/payments/gateway';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await context.params;
    if (provider !== 'paystack' && provider !== 'hubtel') {
      throw new AppError('PAYMENT_PROVIDER_UNSUPPORTED', 'Unsupported payment provider', 400);
    }

    const payload = await request.text();
    const signature = request.headers.get(provider === 'paystack' ? 'x-paystack-signature' : 'x-hubtel-signature');
    const gateway = getPaymentGateway(provider);

    const valid = await gateway.verifyWebhook({ payload, signature });
    if (!valid) {
      throw new AppError('INVALID_WEBHOOK_SIGNATURE', 'Webhook signature validation failed', 401);
    }

    logger.info('Payment webhook accepted', {
      provider,
      payloadLength: payload.length,
    });

    return Response.json({
      success: true,
      data: {
        accepted: true,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
