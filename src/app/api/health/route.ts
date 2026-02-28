import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function checkDb() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'DB check failed' };
  }
}

async function checkRedis() {
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_TOKEN;

  if (!redisUrl || !redisToken) {
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch(`${redisUrl}/ping`, {
      headers: { Authorization: `Bearer ${redisToken}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'redis_unreachable' };
  }
}

function checkStorage() {
  return {
    ok: Boolean(
      process.env.CLOUDFLARE_R2_ACCESS_KEY
        && process.env.CLOUDFLARE_R2_SECRET_KEY
        && process.env.CLOUDFLARE_R2_BUCKET,
    ),
  };
}

function checkEmail() {
  return { ok: Boolean(process.env.RESEND_API_KEY) };
}

function checkPush() {
  return { ok: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) };
}

function checkPayments() {
  return {
    ok: Boolean(
      process.env.PAYSTACK_SECRET_KEY
        || (process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET),
    ),
  };
}

function checkQstash() {
  return { ok: Boolean(process.env.UPSTASH_QSTASH_URL && process.env.UPSTASH_QSTASH_TOKEN) };
}

function checkSentry() {
  return { ok: Boolean(process.env.SENTRY_DSN) };
}

export async function GET() {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
  const storage = checkStorage();
  const email = checkEmail();
  const push = checkPush();
  const payments = checkPayments();
  const qstash = checkQstash();
  const sentry = checkSentry();

  const all = { db, redis, storage, email, push, payments, qstash, sentry };
  const healthy = Object.values(all).every((item) => item.ok);

  return Response.json({
    success: true,
    data: {
      status: healthy ? 'ok' : 'degraded',
      checks: all,
      checkedAt: new Date().toISOString(),
    },
  });
}
