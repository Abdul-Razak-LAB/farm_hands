import { AppError, createErrorResponse } from '@/lib/errors';
import { enqueueDelayedJob } from '@/lib/integrations/queue/qstash';

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = request.headers.get('x-cron-secret');

    if (!cronSecret || headerSecret !== cronSecret) {
      throw new AppError('UNAUTHORIZED_CRON', 'Invalid cron secret', 401);
    }

    const result = await enqueueDelayedJob({
      url: `${process.env.APP_URL || 'http://localhost:3000'}/api/farms/system/weekly-digest`,
      payload: { type: 'DIGEST_REMINDER', queuedAt: new Date().toISOString() },
      delaySeconds: 10,
    });

    return Response.json({
      success: true,
      data: {
        queued: result.queued,
        skipped: result.skipped,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
