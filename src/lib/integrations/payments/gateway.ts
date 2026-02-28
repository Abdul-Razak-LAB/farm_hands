import { createHmac } from 'node:crypto';
import { AppError } from '@/lib/errors';

export type PaymentInitInput = {
  amount: number;
  currency: string;
  reference: string;
  customerEmail?: string;
};

export type PaymentGateway = {
  provider: 'paystack' | 'hubtel';
  initializePayment(input: PaymentInitInput): Promise<{ checkoutUrl?: string; reference: string }>;
  verifyWebhook(input: { payload: string; signature: string | null }): Promise<boolean>;
};

class PaystackGateway implements PaymentGateway {
  provider = 'paystack' as const;

  async initializePayment(input: PaymentInitInput) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      throw new AppError('PAYMENTS_UNAVAILABLE', 'Paystack is not configured', 503);
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        reference: input.reference,
        email: input.customerEmail || 'no-reply@farmops.local',
      }),
    });

    if (!response.ok) {
      throw new AppError('PAYMENT_INIT_FAILED', 'Failed to initialize Paystack payment', 502);
    }

    const json = await response.json() as { data?: { authorization_url?: string; reference?: string } };
    return {
      checkoutUrl: json.data?.authorization_url,
      reference: json.data?.reference || input.reference,
    };
  }

  async verifyWebhook(input: { payload: string; signature: string | null }) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret || !input.signature) {
      return false;
    }

    const computed = createHmac('sha512', secret).update(input.payload).digest('hex');
    return computed === input.signature;
  }
}

class HubtelGateway implements PaymentGateway {
  provider = 'hubtel' as const;

  async initializePayment(input: PaymentInitInput) {
    const clientId = process.env.HUBTEL_CLIENT_ID;
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new AppError('PAYMENTS_UNAVAILABLE', 'Hubtel is not configured', 503);
    }

    return {
      reference: input.reference,
      checkoutUrl: undefined,
    };
  }

  async verifyWebhook(input: { payload: string; signature: string | null }) {
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
    if (!clientSecret || !input.signature) {
      return false;
    }

    const computed = createHmac('sha256', clientSecret).update(input.payload).digest('hex');
    return computed === input.signature;
  }
}

export function getPaymentGateway(provider: 'paystack' | 'hubtel'): PaymentGateway {
  if (provider === 'paystack') return new PaystackGateway();
  return new HubtelGateway();
}
