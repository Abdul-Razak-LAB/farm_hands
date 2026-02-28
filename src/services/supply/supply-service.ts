import { Prisma } from '@prisma/client';
import { AppError } from '@/lib/errors';

export class SupplyService {
  async receiveDelivery(tx: Prisma.TransactionClient, farmId: string, payload: { poId: string; items: { itemId: string; qty: number }[] }) {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: payload.poId, farmId },
      include: { items: true }
    });

    if (!po) throw new AppError('PO_NOT_FOUND', 'Purchase order not found', 404);
    if (po.status === 'DELIVERED') return { status: 'ALREADY_DELIVERED' };

    // 1. Update Inventory and Record Movements
    for (const dItem of payload.items) {
      await tx.inventoryItem.update({
        where: { id: dItem.itemId },
        data: { balance: { increment: dItem.qty } }
      });

      await tx.inventoryMovement.create({
        data: {
          itemId: dItem.itemId,
          qty: dItem.qty,
          type: 'PROCUREMENT',
        }
      });
    }

    // 2. Update PO status
    await tx.purchaseOrder.update({
      where: { id: payload.poId },
      data: { status: 'DELIVERED' }
    });

    return { poId: payload.poId, status: 'DELIVERED' };
  }
}

export const supplyService = new SupplyService();
