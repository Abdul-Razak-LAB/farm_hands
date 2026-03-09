import { AppError, createErrorResponse } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { farmhandsService } from '@/services/farmhands/farmhands-service';

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = request.headers.get('x-cron-secret');

    if (!cronSecret || headerSecret !== cronSecret) {
      throw new AppError('UNAUTHORIZED_CRON', 'Invalid cron secret', 401);
    }

    const farms = await prisma.farm.findMany({
      select: { id: true },
      take: 500,
    });

    const results = [] as Array<{ farmId: string; scanned: number; escalated: number; skipped: number }>;

    for (const farm of farms) {
      const run = await farmhandsService.runSlaEscalationScan({
        farmId: farm.id,
        actorUserId: 'system_cron',
      });

      results.push({
        farmId: farm.id,
        scanned: run.scanned,
        escalated: run.escalated,
        skipped: run.skipped,
      });
    }

    return Response.json({
      success: true,
      data: {
        farmsProcessed: farms.length,
        totalEscalated: results.reduce((sum, item) => sum + item.escalated, 0),
        results,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
