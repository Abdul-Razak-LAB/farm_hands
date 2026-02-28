import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

export class FinanceService {
  async listBudgets(farmId: string) {
    return prisma.budget.findMany({
      where: { farmId },
      include: { lines: true },
      orderBy: { startDate: 'desc' },
      take: 20,
    });
  }

  async listSpendRequests(farmId: string) {
    return prisma.spendRequest.findMany({
      where: { farmId },
      include: { approvals: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async requestExpense(input: {
    farmId: string;
    userId: string;
    amount: number;
    category: string;
    description: string;
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

    const request = await prisma.$transaction(async (tx: any) => {
      const created = await tx.spendRequest.create({
        data: {
          farmId: input.farmId,
          amount: input.amount,
          category: input.category,
          description: input.description,
          status: 'PENDING',
        },
      });

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'SPEND_REQUEST_CREATED',
          payload: {
            requestId: created.id,
            amount: input.amount,
            category: input.category,
          },
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
        },
      });

      return created;
    }, { isolationLevel: 'Serializable' });

    return { requestId: request.id, status: request.status };
  }

  async decideExpense(input: {
    farmId: string;
    requestId: string;
    userId: string;
    decision: 'APPROVED' | 'REJECTED';
    comment?: string;
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

    const request = await prisma.spendRequest.findFirst({
      where: { id: input.requestId, farmId: input.farmId },
    });

    if (!request) {
      throw new AppError('REQUEST_NOT_FOUND', 'Spend request not found', 404);
    }

    if (request.status !== 'PENDING') {
      return { requestId: request.id, status: request.status };
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.spendRequest.update({
        where: { id: input.requestId },
        data: { status: input.decision },
      });

      await tx.approval.create({
        data: {
          spendRequestId: input.requestId,
          userId: input.userId,
          status: input.decision,
          comment: input.comment,
        },
      });

      if (input.decision === 'APPROVED') {
        const activeBudget = await tx.budget.findFirst({
          where: {
            farmId: input.farmId,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
          include: { lines: true },
        });

        const matchedLine = activeBudget?.lines.find((line: any) => line.category === request.category);

        if (matchedLine) {
          await tx.budgetLine.update({
            where: { id: matchedLine.id },
            data: { spent: { increment: request.amount } },
          });
        }
      }

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'SPEND_REQUEST_DECIDED',
          payload: {
            requestId: input.requestId,
            decision: input.decision,
            comment: input.comment,
          },
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
        },
      });

      return updated;
    }, { isolationLevel: 'Serializable' });

    return { requestId: result.id, status: result.status };
  }
}

export const financeService = new FinanceService();
