import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

export class VendorService {
  async listOrders(farmId: string) {
    return prisma.purchaseOrder.findMany({
      where: {
        farmId,
        status: { in: ['ISSUED', 'DELIVERED'] },
      },
      include: {
        vendor: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async confirmOrder(input: {
    farmId: string;
    userId: string;
    poId: string;
    invoiceNumber: string;
    evidenceUrl?: string;
    idempotencyKey: string;
  }) {
    const po = await prisma.purchaseOrder.findFirst({ where: { id: input.poId, farmId: input.farmId } });
    if (!po) {
      throw new AppError('PO_NOT_FOUND', 'Purchase order not found', 404);
    }

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

    await prisma.$transaction(async (tx: any) => {
      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'VENDOR_PO_CONFIRMED',
          payload: {
            poId: input.poId,
            invoiceNumber: input.invoiceNumber,
            evidenceUrl: input.evidenceUrl,
          },
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      if (po.status === 'ISSUED') {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: 'DELIVERED' },
        });
      }
    }, { isolationLevel: 'Serializable' });

    return { poId: input.poId, status: 'CONFIRMED' };
  }
}

export const vendorService = new VendorService();
