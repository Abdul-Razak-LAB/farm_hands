import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { runSerializableTransactionWithRetry } from '@/lib/transaction-retry';

type PurchaseOrderItemInput = {
  description: string;
  qty: number;
  unitPrice: number;
};

export class ProcurementService {
  async requestPurchase(input: {
    farmId: string;
    userId: string;
    reason: string;
    vendorId?: string;
    amount: number;
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
      return { requestId: existing.id, reused: true };
    }

    const created = await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'PURCHASE_REQUESTED',
        payload: {
          reason: input.reason,
          vendorId: input.vendorId,
          amount: input.amount,
        },
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
      },
    });

    return { requestId: created.id, status: 'PENDING_REVIEW' };
  }

  async listPurchaseRequests(farmId: string) {
    const requests = await prisma.event.findMany({
      where: {
        farmId,
        type: 'PURCHASE_REQUESTED',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return requests;
  }

  async createPurchaseOrder(input: {
    farmId: string;
    vendorId: string;
    items: PurchaseOrderItemInput[];
    userId: string;
    idempotencyKey: string;
  }) {
    const existingEvent = await prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    if (existingEvent) {
      return { reused: true, idempotencyKey: input.idempotencyKey };
    }

    const vendor = await prisma.vendor.findFirst({
      where: { id: input.vendorId, farmId: input.farmId },
    });

    if (!vendor) {
      throw new AppError('VENDOR_NOT_FOUND', 'Vendor not found for this farm', 404);
    }

    const po = await runSerializableTransactionWithRetry(async (tx: any) => {
      const created = await tx.purchaseOrder.create({
        data: {
          farmId: input.farmId,
          vendorId: input.vendorId,
          status: 'ISSUED',
          items: {
            create: input.items.map((item) => ({
              description: item.description,
              qty: item.qty,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'PO_CREATED',
          payload: {
            poId: created.id,
            vendorId: input.vendorId,
            itemCount: input.items.length,
          },
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
        },
      });

      return created;
    });

    return po;
  }

  async listPurchaseOrders(farmId: string) {
    return prisma.purchaseOrder.findMany({
      where: { farmId },
      include: {
        items: true,
        vendor: true,
        reconciliation: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async confirmDelivery(input: {
    farmId: string;
    poId: string;
    items: Array<{ itemId: string; qty: number }>;
    userId: string;
    discrepancyNote?: string;
    idempotencyKey: string;
  }) {
    const existingEvent = await prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    if (existingEvent) {
      return { reused: true };
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: input.poId, farmId: input.farmId },
    });

    if (!po) {
      throw new AppError('PO_NOT_FOUND', 'Purchase order not found', 404);
    }

    const result = await runSerializableTransactionWithRetry(async (tx: any) => {
      for (const deliveryItem of input.items) {
        await tx.inventoryItem.update({
          where: { id: deliveryItem.itemId },
          data: { balance: { increment: deliveryItem.qty } },
        });

        await tx.inventoryMovement.create({
          data: {
            itemId: deliveryItem.itemId,
            qty: deliveryItem.qty,
            type: 'PROCUREMENT',
          },
        });
      }

      await tx.purchaseOrder.update({
        where: { id: input.poId },
        data: { status: 'DELIVERED' },
      });

      if (input.discrepancyNote) {
        await tx.pOReconciliation.upsert({
          where: { poId: input.poId },
          create: {
            poId: input.poId,
            status: 'DISCREPANCY',
            diffs: { note: input.discrepancyNote },
          },
          update: {
            status: 'DISCREPANCY',
            diffs: { note: input.discrepancyNote },
          },
        });
      }

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'PO_DELIVERED',
          payload: {
            poId: input.poId,
            discrepancy: Boolean(input.discrepancyNote),
          },
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
        },
      });

      return { poId: input.poId, status: 'DELIVERED' };
    });

    return result;
  }
}

export const procurementService = new ProcurementService();
