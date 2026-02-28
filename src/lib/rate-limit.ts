import { NextRequest } from 'next/server';

type RateLimitProfile = {
  limit: number;
  windowSeconds: number;
};

const profiles: Record<'auth' | 'write', RateLimitProfile> = {
  auth: { limit: 10, windowSeconds: 60 },
  write: { limit: 120, windowSeconds: 60 },
};

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown-ip';
  }
  return 'unknown-ip';
}

async function incrementInRedis(key: string, windowSeconds: number) {
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  const headers = { Authorization: `Bearer ${redisToken}` };
  const encodedKey = encodeURIComponent(key);

  const incrResponse = await fetch(`${redisUrl}/incr/${encodedKey}`, { headers, cache: 'no-store' });
  if (!incrResponse.ok) {
    return null;
  }

  const incrJson = (await incrResponse.json()) as { result?: number };
  const count = Number(incrJson.result || 0);

  if (count <= 1) {
    await fetch(`${redisUrl}/expire/${encodedKey}/${windowSeconds}`, { headers, cache: 'no-store' });
  }

  return count;
}

function incrementInMemory(key: string, windowSeconds: number) {
  const now = Date.now();
  const current = memoryStore.get(key);
  const nextResetAt = now + windowSeconds * 1000;

  if (!current || current.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: nextResetAt });
    return 1;
  }

  const nextCount = current.count + 1;
  memoryStore.set(key, { count: nextCount, resetAt: current.resetAt });
  return nextCount;
}

export async function checkRateLimit(input: {
  request: NextRequest;
  profile: 'auth' | 'write';
  userId?: string;
  farmId?: string;
}) {
  const config = profiles[input.profile];
  const ip = getClientIp(input.request);
  const route = input.request.nextUrl.pathname;
  const identity = [ip, input.userId || 'anon-user', input.farmId || 'no-farm'].join(':');
  const key = `rl:${input.profile}:${route}:${identity}`;

  const redisCount = await incrementInRedis(key, config.windowSeconds);
  const count = redisCount ?? incrementInMemory(key, config.windowSeconds);

  const limited = count > config.limit;
  return {
    limited,
    limit: config.limit,
    remaining: Math.max(0, config.limit - count),
    retryAfterSeconds: config.windowSeconds,
  };
}
