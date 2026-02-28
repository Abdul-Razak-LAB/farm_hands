import { prisma } from '@/lib/prisma';

export class ControlService {
  async submitDailyUpdate(input: {
    farmId: string;
    userId: string;
    summary: string;
    blockers?: string;
    voiceNoteUrl?: string;
    idempotencyKey: string;
  }) {
    const existing = await prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    if (existing) {
      return { reused: true, eventId: existing.id };
    }

    const event = await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'DAILY_UPDATE_SUBMITTED',
        payload: {
          summary: input.summary,
          blockers: input.blockers,
          voiceNoteUrl: input.voiceNoteUrl,
        },
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
      },
    });

    return { eventId: event.id, status: 'RECORDED' };
  }

  async listDailyUpdates(farmId: string, limit = 30) {
    return prisma.event.findMany({
      where: {
        farmId,
        type: 'DAILY_UPDATE_SUBMITTED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getWeeklyDigest(farmId: string) {
    const start = new Date();
    start.setDate(start.getDate() - 7);

    const [weeklyEvents, unresolvedAlerts, payrollRuns, openPOs] = await Promise.all([
      prisma.event.findMany({
        where: { farmId, createdAt: { gte: start } },
      }),
      prisma.alert.count({ where: { farmId, resolved: false } }),
      prisma.payrollRun.count({ where: { farmId, status: { not: 'PAID' } } }),
      prisma.purchaseOrder.count({ where: { farmId, status: { in: ['ISSUED', 'DELIVERED'] } } }),
    ]);

    const byType = weeklyEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});

    return {
      periodDays: 7,
      totals: {
        events: weeklyEvents.length,
        unresolvedAlerts,
        pendingPayrollRuns: payrollRuns,
        openPurchaseOrders: openPOs,
      },
      byType,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const controlService = new ControlService();
