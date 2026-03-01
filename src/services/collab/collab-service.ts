import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

type AttachmentInput = {
  fileUrl: string;
  fileName?: string;
  contentType?: string;
  size?: number;
};

export class CollabService {
  async listMessages(farmId: string, limit = 100) {
    const events = await prisma.event.findMany({
      where: { farmId, type: 'MESSAGE_SENT' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return events.map((event) => ({
      id: event.id,
      farmId: event.farmId,
      userId: event.userId,
      createdAt: event.createdAt,
      payload: event.payload,
    }));
  }

  async sendMessage(input: {
    farmId: string;
    userId: string;
    idempotencyKey: string;
    text: string;
    threadId?: string;
    attachments?: AttachmentInput[];
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

    const normalizedAttachments = (input.attachments ?? [])
      .filter((entry) => typeof entry.fileUrl === 'string' && entry.fileUrl.length > 8)
      .map((entry) => ({
        fileUrl: entry.fileUrl,
        fileName: entry.fileName || entry.fileUrl.split('/').pop() || 'attachment',
        contentType: entry.contentType || 'application/octet-stream',
        size: Number.isFinite(entry.size) ? Number(entry.size) : 0,
        hash: createHash('sha256').update(entry.fileUrl).digest('hex'),
      }));

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          farmId: input.farmId,
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
          type: 'MESSAGE_SENT',
          payload: {
            text: input.text,
            threadId: input.threadId || 'general',
            attachments: normalizedAttachments,
          },
        },
      });

      if (normalizedAttachments.length) {
        await tx.attachment.createMany({
          data: normalizedAttachments.map((attachment) => ({
            farmId: input.farmId,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl,
            contentType: attachment.contentType,
            size: attachment.size,
            hash: attachment.hash,
            metadata: {
              source: 'MESSAGE_ATTACHMENT',
              eventId: created.id,
            },
          })),
        });
      }

      return created;
    }, { isolationLevel: 'Serializable' });

    return { eventId: event.id, status: 'SENT' };
  }
}

export const collabService = new CollabService();
