import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { runSerializableTransactionWithRetry } from '@/lib/transaction-retry';

type PayrollEntryInput = {
  userId: string;
  grossAmount: number;
  netAmount: number;
};

export class PayrollService {
  async listRuns(farmId: string) {
    return prisma.payrollRun.findMany({
      where: { farmId },
      include: { entries: true },
      orderBy: { startDate: 'desc' },
      take: 20,
    });
  }

  async createRun(input: {
    farmId: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    entries: PayrollEntryInput[];
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

    const run = await runSerializableTransactionWithRetry(async (tx: any) => {
      const createdRun = await tx.payrollRun.create({
        data: {
          farmId: input.farmId,
          startDate: input.startDate,
          endDate: input.endDate,
          status: 'DRAFT',
          entries: {
            create: input.entries.map((entry) => ({
              userId: entry.userId,
              grossAmount: entry.grossAmount,
              netAmount: entry.netAmount,
              status: 'DRAFT',
            })),
          },
        },
        include: { entries: true },
      });

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'PAYROLL_RUN_CREATED',
          payload: {
            runId: createdRun.id,
            entryCount: input.entries.length,
          },
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
        },
      });

      return createdRun;
    });

    return run;
  }

  async approveRun(input: {
    farmId: string;
    runId: string;
    userId: string;
    idempotencyKey: string;
    comment?: string;
  }) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: input.runId, farmId: input.farmId },
    });

    if (!run) {
      throw new AppError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found', 404);
    }

    if (run.status === 'PAID') {
      return { runId: run.id, status: 'ALREADY_PAID' };
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

    const approved = await runSerializableTransactionWithRetry(async (tx: any) => {
      const updated = await tx.payrollRun.update({
        where: { id: input.runId },
        data: { status: 'PROCESSING' },
      });

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'PAYROLL_RUN_APPROVED',
          payload: {
            runId: input.runId,
            comment: input.comment,
          },
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
        },
      });

      return updated;
    });

    return { runId: approved.id, status: approved.status };
  }

  async markPaid(input: {
    farmId: string;
    runId: string;
    userId: string;
    idempotencyKey: string;
    reference: string;
  }) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: input.runId, farmId: input.farmId },
      include: { entries: true },
    });

    if (!run) {
      throw new AppError('PAYROLL_RUN_NOT_FOUND', 'Payroll run not found', 404);
    }

    if (run.status === 'PAID') {
      return { runId: run.id, status: 'ALREADY_PAID' };
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

    const paid = await runSerializableTransactionWithRetry(async (tx: any) => {
      await tx.payrollEntry.updateMany({
        where: { payrollRunId: input.runId },
        data: { status: 'PAID' },
      });

      const updated = await tx.payrollRun.update({
        where: { id: input.runId },
        data: { status: 'PAID' },
      });

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'PAYROLL_PAID',
          payload: {
            runId: input.runId,
            reference: input.reference,
          },
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
        },
      });

      return updated;
    });

    return { runId: paid.id, status: paid.status };
  }
}

export const payrollService = new PayrollService();
