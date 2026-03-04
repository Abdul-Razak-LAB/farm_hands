import { NextResponse } from 'next/server';

function isUploadAvailable() {
  const hasR2Config = Boolean(
    process.env.CLOUDFLARE_R2_ACCESS_KEY
      && process.env.CLOUDFLARE_R2_SECRET_KEY
      && process.env.CLOUDFLARE_R2_BUCKET
      && process.env.CLOUDFLARE_R2_ENDPOINT,
  );

  if (hasR2Config) {
    return true;
  }

  const localUploadsDisabled = process.env.LOCAL_UPLOADS_DISABLED === 'true';
  return !localUploadsDisabled;
}

function jsonNoStore(body: unknown) {
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

export const dynamic = 'force-dynamic';

function isPushAvailable() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function isEmailAvailable() {
  return Boolean(
    process.env.RESEND_API_KEY,
  );
}

export async function GET() {
  if (process.env.NODE_ENV !== 'production') {
    return jsonNoStore({
      success: true,
      data: {
        upload: true,
        push: true,
        email: true,
      },
    });
  }

  return jsonNoStore({
    success: true,
    data: {
      upload: isUploadAvailable(),
      push: isPushAvailable(),
      email: isEmailAvailable(),
    },
  });
}
