import { prisma } from '@/lib/prisma';

export class IncidentService {
  async reportIssue(input: {
    farmId: string;
    userId: string;
    title: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details?: string;
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
      return { reused: true, issueEventId: existing.id };
    }

    const event = await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'ISSUE_REPORTED',
        payload: {
          title: input.title,
          severity: input.severity,
          details: input.details,
        },
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
      },
    });

    return { issueEventId: event.id, status: 'OPEN' };
  }

  async requestExpert(input: {
    farmId: string;
    userId: string;
    issueEventId: string;
    note?: string;
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
      return { reused: true };
    }

    const event = await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'EXPERT_REQUESTED',
        payload: {
          issueEventId: input.issueEventId,
          note: input.note,
        },
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
      },
    });

    return { expertRequestEventId: event.id, status: 'REQUESTED' };
  }

  async resolveIssue(input: {
    farmId: string;
    userId: string;
    issueEventId: string;
    resolution: string;
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
      return { reused: true };
    }

    const event = await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'ISSUE_RESOLVED',
        payload: {
          issueEventId: input.issueEventId,
          resolution: input.resolution,
        },
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
      },
    });

    return { resolutionEventId: event.id, status: 'RESOLVED' };
  }

  async getTimeline(farmId: string) {
    const events = await prisma.event.findMany({
      where: {
        farmId,
        type: {
          in: ['ISSUE_REPORTED', 'EXPERT_REQUESTED', 'ISSUE_RESOLVED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return events;
  }
}

export const incidentService = new IncidentService();
