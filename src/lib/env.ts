import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  APP_SECRET: z.string().min(32),
  APP_URL: z.string().url().optional(),
  UPSTASH_REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),
  UPSTASH_QSTASH_URL: z.string().url().optional(),
  UPSTASH_QSTASH_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_SECRET_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET: z.string().optional(),
  CLOUDFLARE_R2_ENDPOINT: z.string().url().optional(),
  CLOUDFLARE_R2_PUBLIC_BASE_URL: z.string().url().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  HUBTEL_CLIENT_ID: z.string().optional(),
  HUBTEL_CLIENT_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success && process.env.NODE_ENV === 'production') {
  console.error('❌ Environment validation failed:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = (parsedEnv.success ? parsedEnv.data : process.env) as z.infer<typeof envSchema>;

export function validateEnv() {
  if (!parsedEnv.success) {
    console.warn('⚠️ Environment validation warnings:', parsedEnv.error.flatten().fieldErrors);
    return;
  }

  const checks = {
    storage: Boolean(env.CLOUDFLARE_R2_ACCESS_KEY && env.CLOUDFLARE_R2_SECRET_KEY && env.CLOUDFLARE_R2_BUCKET && env.CLOUDFLARE_R2_ENDPOINT),
    redis: Boolean(env.UPSTASH_REDIS_URL && env.UPSTASH_REDIS_TOKEN),
    qstash: Boolean(env.UPSTASH_QSTASH_URL && env.UPSTASH_QSTASH_TOKEN),
    email: Boolean(env.RESEND_API_KEY),
    push: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    payments: Boolean(env.PAYSTACK_SECRET_KEY || (env.HUBTEL_CLIENT_ID && env.HUBTEL_CLIENT_SECRET)),
    sentry: Boolean(env.SENTRY_DSN),
  };

  const missingOptional = Object.entries(checks)
    .filter(([, configured]) => !configured)
    .map(([name]) => name);

  if (missingOptional.length > 0) {
    console.warn(`⚠️ Optional integrations not configured: ${missingOptional.join(', ')}`);
  } else {
    console.log('✅ Environment validated');
  }
}
