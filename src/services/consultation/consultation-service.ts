import { prisma } from '@/lib/prisma';

type ConsultationUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type ConsultationStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
type ConsultationMessageSender = 'FARMER' | 'EXPERT';

type ConsultationRequestedPayload = {
  consultationId: string;
  topic: string;
  question: string;
  urgency: ConsultationUrgency;
  status: ConsultationStatus;
};

type ConsultationMessagePayload = {
  consultationId: string;
  text: string;
  sender: ConsultationMessageSender;
};

type ConsultationAssignedPayload = {
  consultationId: string;
  assigneeName?: string;
  assigneeEmail?: string;
  note?: string;
};

type ConsultationStatusPayload = {
  consultationId: string;
  status: ConsultationStatus;
  note?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asRequestedPayload(payload: unknown): ConsultationRequestedPayload | null {
  if (!isRecord(payload)) return null;
  const consultationId = payload.consultationId;
  const topic = payload.topic;
  const question = payload.question;
  const urgency = payload.urgency;
  const status = payload.status;

  if (
    typeof consultationId !== 'string'
    || typeof topic !== 'string'
    || typeof question !== 'string'
    || (urgency !== 'LOW' && urgency !== 'MEDIUM' && urgency !== 'HIGH' && urgency !== 'URGENT')
    || (status !== 'OPEN' && status !== 'IN_PROGRESS' && status !== 'RESOLVED')
  ) {
    return null;
  }

  return { consultationId, topic, question, urgency, status };
}

function asMessagePayload(payload: unknown): ConsultationMessagePayload | null {
  if (!isRecord(payload)) return null;
  const consultationId = payload.consultationId;
  const text = payload.text;
  const sender = payload.sender;

  if (
    typeof consultationId !== 'string'
    || typeof text !== 'string'
    || (sender !== 'FARMER' && sender !== 'EXPERT')
  ) {
    return null;
  }

  return { consultationId, text, sender };
}

function asStatusPayload(payload: unknown): ConsultationStatusPayload | null {
  if (!isRecord(payload)) return null;
  const consultationId = payload.consultationId;
  const status = payload.status;
  const note = payload.note;

  if (
    typeof consultationId !== 'string'
    || (status !== 'OPEN' && status !== 'IN_PROGRESS' && status !== 'RESOLVED')
    || (note !== undefined && typeof note !== 'string')
  ) {
    return null;
  }

  return { consultationId, status, note };
}

function asAssignedPayload(payload: unknown): ConsultationAssignedPayload | null {
  if (!isRecord(payload)) return null;

  const consultationId = payload.consultationId;
  const assigneeName = payload.assigneeName;
  const assigneeEmail = payload.assigneeEmail;
  const note = payload.note;

  if (
    typeof consultationId !== 'string'
    || (assigneeName !== undefined && typeof assigneeName !== 'string')
    || (assigneeEmail !== undefined && typeof assigneeEmail !== 'string')
    || (note !== undefined && typeof note !== 'string')
  ) {
    return null;
  }

  return { consultationId, assigneeName, assigneeEmail, note };
}

export class ConsultationService {
  private async createNotificationEvent(input: {
    farmId: string;
    userId: string;
    consultationId: string;
    action: 'REQUESTED' | 'ASSIGNED' | 'STATUS_UPDATED' | 'FARMER_MESSAGE';
    details?: Record<string, unknown>;
  }) {
    await prisma.event.create({
      data: {
        farmId: input.farmId,
        userId: input.userId,
        type: 'CONSULTATION_NOTIFICATION_TRIGGERED',
        payload: {
          consultationId: input.consultationId,
          action: input.action,
          channels: ['IN_APP'],
          audience: ['OWNER', 'MANAGER'],
          ...(input.details || {}),
        },
      },
    });
  }

  async requestConsultation(input: {
    farmId: string;
    userId: string;
    topic: string;
    question: string;
    urgency: ConsultationUrgency;
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
      const payload = asRequestedPayload(existing.payload);
      return {
        reused: true,
        consultationId: payload?.consultationId,
      };
    }

    const consultationId = crypto.randomUUID();

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        userId: input.userId,
        type: 'CONSULTATION_REQUESTED',
        idempotencyKey: input.idempotencyKey,
        payload: {
          consultationId,
          topic: input.topic,
          question: input.question,
          urgency: input.urgency,
          status: 'OPEN',
        },
      },
    });

    await this.createNotificationEvent({
      farmId: input.farmId,
      userId: input.userId,
      consultationId,
      action: 'REQUESTED',
      details: {
        topic: input.topic,
        urgency: input.urgency,
      },
    });

    return {
      consultationId,
      status: 'OPEN' as const,
    };
  }

  async sendMessage(input: {
    farmId: string;
    userId: string;
    consultationId: string;
    text: string;
    sender: ConsultationMessageSender;
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
        userId: input.userId,
        type: 'CONSULTATION_MESSAGE',
        idempotencyKey: input.idempotencyKey,
        payload: {
          consultationId: input.consultationId,
          text: input.text,
          sender: input.sender,
        },
      },
    });

    if (input.sender === 'FARMER') {
      await this.createNotificationEvent({
        farmId: input.farmId,
        userId: input.userId,
        consultationId: input.consultationId,
        action: 'FARMER_MESSAGE',
      });
    }

    return { messageEventId: event.id };
  }

  async assignExpert(input: {
    farmId: string;
    userId: string;
    consultationId: string;
    assigneeName?: string;
    assigneeEmail?: string;
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

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        userId: input.userId,
        type: 'CONSULTATION_ASSIGNED',
        idempotencyKey: input.idempotencyKey,
        payload: {
          consultationId: input.consultationId,
          assigneeName: input.assigneeName,
          assigneeEmail: input.assigneeEmail,
          note: input.note,
        },
      },
    });

    await this.createNotificationEvent({
      farmId: input.farmId,
      userId: input.userId,
      consultationId: input.consultationId,
      action: 'ASSIGNED',
      details: {
        assigneeName: input.assigneeName,
        assigneeEmail: input.assigneeEmail,
      },
    });

    return { assigned: true };
  }

  async updateStatus(input: {
    farmId: string;
    userId: string;
    consultationId: string;
    status: ConsultationStatus;
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

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        userId: input.userId,
        type: 'CONSULTATION_STATUS_UPDATED',
        idempotencyKey: input.idempotencyKey,
        payload: {
          consultationId: input.consultationId,
          status: input.status,
          note: input.note,
        },
      },
    });

    await this.createNotificationEvent({
      farmId: input.farmId,
      userId: input.userId,
      consultationId: input.consultationId,
      action: 'STATUS_UPDATED',
      details: { status: input.status },
    });

    return { status: input.status };
  }

  async listConsultations(farmId: string) {
    const events = await prisma.event.findMany({
      where: {
        farmId,
        type: {
          in: ['CONSULTATION_REQUESTED', 'CONSULTATION_MESSAGE', 'CONSULTATION_STATUS_UPDATED', 'CONSULTATION_ASSIGNED'],
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    const byConsultationId = new Map<string, {
      consultationId: string;
      topic: string;
      question: string;
      urgency: ConsultationUrgency;
      status: ConsultationStatus;
      createdAt: Date;
      updatedAt: Date;
      messageCount: number;
      lastMessage?: string;
      assignedExpert?: {
        name?: string;
        email?: string;
      };
      assignedAt?: Date;
    }>();

    for (const event of events) {
      if (event.type === 'CONSULTATION_REQUESTED') {
        const payload = asRequestedPayload(event.payload);
        if (!payload) continue;

        byConsultationId.set(payload.consultationId, {
          consultationId: payload.consultationId,
          topic: payload.topic,
          question: payload.question,
          urgency: payload.urgency,
          status: payload.status,
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
          messageCount: 0,
        });
        continue;
      }

      const payload = isRecord(event.payload) ? event.payload : null;
      const consultationId = typeof payload?.consultationId === 'string' ? payload.consultationId : null;
      if (!consultationId) continue;

      const current = byConsultationId.get(consultationId);
      if (!current) continue;

      if (event.type === 'CONSULTATION_MESSAGE') {
        const messagePayload = asMessagePayload(event.payload);
        if (!messagePayload) continue;
        current.messageCount += 1;
        current.lastMessage = messagePayload.text;
      }

      if (event.type === 'CONSULTATION_STATUS_UPDATED') {
        const statusPayload = asStatusPayload(event.payload);
        if (!statusPayload) continue;
        current.status = statusPayload.status;
      }

      if (event.type === 'CONSULTATION_ASSIGNED') {
        const assignedPayload = asAssignedPayload(event.payload);
        if (!assignedPayload) continue;
        current.assignedExpert = {
          name: assignedPayload.assigneeName,
          email: assignedPayload.assigneeEmail,
        };
        current.assignedAt = event.createdAt;
      }

      current.updatedAt = event.createdAt;
    }

    return Array.from(byConsultationId.values()).sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async listMessages(farmId: string, consultationId: string) {
    const events = await prisma.event.findMany({
      where: {
        farmId,
        type: {
          in: ['CONSULTATION_REQUESTED', 'CONSULTATION_MESSAGE', 'CONSULTATION_STATUS_UPDATED', 'CONSULTATION_ASSIGNED'],
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    return events
      .map((event) => {
        if (event.type === 'CONSULTATION_REQUESTED') {
          const payload = asRequestedPayload(event.payload);
          if (!payload || payload.consultationId !== consultationId) return null;
          return {
            id: event.id,
            type: 'REQUEST' as const,
            text: payload.question,
            sender: 'FARMER' as ConsultationMessageSender,
            createdAt: event.createdAt,
          };
        }

        if (event.type === 'CONSULTATION_MESSAGE') {
          const payload = asMessagePayload(event.payload);
          if (!payload || payload.consultationId !== consultationId) return null;
          return {
            id: event.id,
            type: 'MESSAGE' as const,
            text: payload.text,
            sender: payload.sender,
            createdAt: event.createdAt,
          };
        }

        if (event.type === 'CONSULTATION_ASSIGNED') {
          const payload = asAssignedPayload(event.payload);
          if (!payload || payload.consultationId !== consultationId) return null;
          return {
            id: event.id,
            type: 'STATUS' as const,
            text: payload.note || `Assigned to ${payload.assigneeName || payload.assigneeEmail || 'expert'}`,
            sender: 'EXPERT' as ConsultationMessageSender,
            createdAt: event.createdAt,
          };
        }

        const payload = asStatusPayload(event.payload);
        if (!payload || payload.consultationId !== consultationId) return null;
        return {
          id: event.id,
          type: 'STATUS' as const,
          text: payload.note || `Status updated to ${payload.status}`,
          sender: 'EXPERT' as ConsultationMessageSender,
          status: payload.status,
          createdAt: event.createdAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  async getAnalytics(farmId: string) {
    const events = await prisma.event.findMany({
      where: {
        farmId,
        type: {
          in: ['CONSULTATION_REQUESTED', 'CONSULTATION_MESSAGE', 'CONSULTATION_STATUS_UPDATED'],
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    const requestedByConsultation = new Map<string, { createdAt: Date; urgency: ConsultationUrgency }>();
    const statusByConsultation = new Map<string, ConsultationStatus>();
    const firstExpertReplyMinutes: number[] = [];
    const firstReplyCaptured = new Set<string>();

    for (const event of events) {
      if (event.type === 'CONSULTATION_REQUESTED') {
        const payload = asRequestedPayload(event.payload);
        if (!payload) continue;
        requestedByConsultation.set(payload.consultationId, {
          createdAt: event.createdAt,
          urgency: payload.urgency,
        });
        statusByConsultation.set(payload.consultationId, payload.status);
        continue;
      }

      if (event.type === 'CONSULTATION_STATUS_UPDATED') {
        const payload = asStatusPayload(event.payload);
        if (!payload) continue;
        statusByConsultation.set(payload.consultationId, payload.status);
        continue;
      }

      const payload = asMessagePayload(event.payload);
      if (!payload || payload.sender !== 'EXPERT') continue;
      if (firstReplyCaptured.has(payload.consultationId)) continue;

      const requested = requestedByConsultation.get(payload.consultationId);
      if (!requested) continue;

      firstReplyCaptured.add(payload.consultationId);
      const minutes = Math.max(0, (event.createdAt.getTime() - requested.createdAt.getTime()) / 60000);
      firstExpertReplyMinutes.push(minutes);
    }

    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let urgentOpenCount = 0;

    for (const [consultationId, requested] of requestedByConsultation.entries()) {
      const status = statusByConsultation.get(consultationId) || 'OPEN';
      if (status === 'OPEN') openCount += 1;
      if (status === 'IN_PROGRESS') inProgressCount += 1;
      if (status === 'RESOLVED') resolvedCount += 1;
      if (status !== 'RESOLVED' && requested.urgency === 'URGENT') urgentOpenCount += 1;
    }

    const averageFirstResponseMinutes = firstExpertReplyMinutes.length
      ? Number((firstExpertReplyMinutes.reduce((sum, current) => sum + current, 0) / firstExpertReplyMinutes.length).toFixed(1))
      : null;

    return {
      totalConsultations: requestedByConsultation.size,
      openCount,
      inProgressCount,
      resolvedCount,
      urgentOpenCount,
      averageFirstResponseMinutes,
    };
  }
}

export const consultationService = new ConsultationService();