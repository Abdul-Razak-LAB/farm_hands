import { AppError } from '@/lib/errors';

export function requireJobSecret(request: Request) {
  const configured = process.env.CRON_SECRET;
  const provided = request.headers.get('x-job-secret') || request.headers.get('x-cron-secret');

  if (!configured || configured !== provided) {
    throw new AppError('UNAUTHORIZED_JOB', 'Invalid job secret', 401);
  }
}
