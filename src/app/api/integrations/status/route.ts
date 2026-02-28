import { NextResponse } from 'next/server';

function isUploadAvailable() {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCESS_KEY
      && process.env.CLOUDFLARE_R2_SECRET_KEY
      && process.env.CLOUDFLARE_R2_BUCKET,
  );
}

function isPushAvailable() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function isEmailAvailable() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function GET() {
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      success: true,
      data: {
        upload: true,
        push: true,
        email: true,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      upload: isUploadAvailable(),
      push: isPushAvailable(),
      email: isEmailAvailable(),
    },
  });
}
