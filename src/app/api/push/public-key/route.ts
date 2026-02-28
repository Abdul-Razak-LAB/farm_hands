import { NextResponse } from 'next/server';

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
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

  return NextResponse.json({
    success: true,
    data: { publicKey },
  });
}
