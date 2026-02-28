// src/services/sync/sync-service.ts

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { taskService } from "../task/task-service";
import { supplyService } from "../supply/supply-service";
import { logger } from '@/lib/logger';
import { runSerializableTransactionWithRetry } from '@/lib/transaction-retry';

export type SyncEvent = {
  type: string;
  payload: any;
  idempotencyKey: string;
  userId: string;
  deviceId?: string;
}

export class SyncService {
  /**
   * Processes a batch of events from the client
   * Each event is processed in isolation to allow partial batch success
   */
  async processBatch(farmId: string, events: SyncEvent[]) {
    const results = [];
    const errorCounts: Record<string, number> = {};

    for (const event of events) {
      try {
        const result = await this.processEvent(farmId, event);
        if (event.deviceId) {
          await prisma.outboxReceipt.upsert({
            where: {
              farmId_idempotencyKey: {
                farmId,
                idempotencyKey: event.idempotencyKey,
              },
            },
            create: {
              farmId,
              deviceId: event.deviceId,
              idempotencyKey: event.idempotencyKey,
              eventType: event.type,
              status: 'SUCCESS',
            },
            update: {
              status: 'SUCCESS',
              errorCode: null,
              errorMessage: null,
            },
          });
        }
        results.push({ idempotencyKey: event.idempotencyKey, success: true, data: result });
      } catch (error: any) {
        logger.error('Sync event processing failed', {
          eventType: event.type,
          idempotencyKey: event.idempotencyKey,
          error: error instanceof Error ? error.message : String(error),
        });
        const code = error.code || 'INTERNAL_ERROR';
        errorCounts[code] = (errorCounts[code] || 0) + 1;
        if (event.deviceId) {
          await prisma.outboxReceipt.upsert({
            where: {
              farmId_idempotencyKey: {
                farmId,
                idempotencyKey: event.idempotencyKey,
              },
            },
            create: {
              farmId,
              deviceId: event.deviceId,
              idempotencyKey: event.idempotencyKey,
              eventType: event.type,
              status: 'FAILED',
              errorCode: code,
              errorMessage: error.message,
            },
            update: {
              status: 'FAILED',
              errorCode: code,
              errorMessage: error.message,
            },
          });
        }
        results.push({ 
          idempotencyKey: event.idempotencyKey, 
          success: false, 
          error: {
            code,
            message: error.message
          },
          retryable: this.isRetryableError(code)
        });
      }
    }

    logger.info('sync.batch.summary', {
      farmId,
      total: events.length,
      succeeded: results.filter((r: any) => r.success).length,
      failed: results.filter((r: any) => !r.success).length,
      errorCounts,
    });

    return results;
  }

  private isRetryableError(code: string) {
    return ['INTERNAL_ERROR', 'DB_SERIALIZATION_CONFLICT', 'TIMEOUT'].includes(code);
  }

  private async processEvent(farmId: string, event: SyncEvent) {
    // 1. Transactional Write with Idempotency Check
    return await runSerializableTransactionWithRetry(async (tx: any) => {
      // Check if event already processed
      const existing = await tx.event.findUnique({
        where: { 
          farmId_idempotencyKey: { farmId, idempotencyKey: event.idempotencyKey } 
        }
      });

      if (existing) return { reused: true };

      // 2. Record the event
      await tx.event.create({
        data: {
          farmId,
          type: event.type,
          payload: event.payload,
          idempotencyKey: event.idempotencyKey,
          userId: event.userId
        }
      });

      // 3. Dispatch to internal domain service
      switch (event.type) {
        case 'TASK_COMPLETED':
          return await taskService.completeTask(tx, farmId, event.payload);
        case 'EXPENSE_REQUESTED':
          return await tx.spendRequest.create({
            data: {
              farmId,
              amount: event.payload.amount,
              category: event.payload.category,
              description: event.payload.description,
              status: 'PENDING',
            },
          });
        case 'PO_DELIVERED':
          return await supplyService.receiveDelivery(tx, farmId, event.payload);
        default:
          throw new AppError('UNKNOWN_EVENT_TYPE', `Unknown event type: ${event.type}`, 400);
      }
    });
  }

  /**
   * Provides incremental data updates for clients
   */
  async getIncrementalDelta(farmId: string, cursor: string | null, limit = 100) {
    const since = cursor ? new Date(cursor) : new Date(0);
    const take = Math.min(Math.max(limit, 1), 200);

    const [tasks, spend, inventory, tombstones] = await Promise.all([
      prisma.task.findMany({
        where: { farmId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
        take,
      }),
      prisma.spendRequest.findMany({
        where: { farmId, createdAt: { gt: since } },
        orderBy: { createdAt: 'asc' },
        take,
      }),
      prisma.inventoryItem.findMany({
        where: { farmId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
        take,
      }),
      prisma.tombstone.findMany({
        where: { farmId, deletedAt: { gt: since } },
        orderBy: { deletedAt: 'asc' },
        take,
      }),
    ]);

    const latestTimestamp = [
      ...tasks.map((item) => item.updatedAt),
      ...spend.map((item) => item.createdAt),
      ...inventory.map((item) => item.updatedAt),
      ...tombstones.map((item) => item.deletedAt),
    ]
      .sort((a, b) => a.getTime() - b.getTime())
      .at(-1);

    const hasMore = [tasks.length, spend.length, inventory.length, tombstones.length].some((count) => count >= take);

    return {
      records: { tasks, spend, inventory },
      tombstones,
      nextCursor: (latestTimestamp || new Date()).toISOString(),
      hasMore,
    };
  }
}

export const syncService = new SyncService();
