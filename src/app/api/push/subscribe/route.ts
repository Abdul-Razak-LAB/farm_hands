import { NextRequest, NextResponse } from 'next/server';

type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    farmId?: string;
    subscription?: PushSubscriptionPayload;
  };

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PUSH_UNAVAILABLE',
          message: 'Push notifications are currently unavailable.',
        },
      },
      { status: 503 },
    );
  }

  if (!body.subscription?.endpoint || !body.subscription.keys?.p256dh || !body.subscription.keys?.auth) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_SUBSCRIPTION',
          message: 'Invalid push subscription payload.',
        },
      },
      { status: 400 },
    );
  }

  console.log('Push subscription received', {
    farmId: body.farmId,
    endpoint: body.subscription.endpoint,
  });

  return NextResponse.json({
    success: true,
    data: {
      subscribed: true,
    },
  });
}
