import { Prisma } from '@prisma/client';
import { AppError } from '@/lib/errors';

export class TaskService {
  async completeTask(tx: Prisma.TransactionClient, farmId: string, payload: { taskId: string; proof?: any }) {
    const task = await tx.task.findUnique({
      where: { id: payload.taskId, farmId }
    });

    if (!task) {
      throw new AppError('TASK_NOT_FOUND', 'Task does not exist for this farm', 404);
    }

    if (task.status === 'COMPLETED') {
      return { status: 'ALREADY_COMPLETED' };
    }

    const updatedTask = await tx.task.update({
      where: { id: payload.taskId },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date()
      }
    });

    // Handle Proof Processing (Async job would be better)
    if (payload.proof) {
      await tx.attachment.create({
        data: {
          farmId,
          taskId: payload.taskId,
          fileName: `proof_${payload.taskId}.jpg`,
          fileUrl: payload.proof.url,
          contentType: 'image/jpeg',
          size: payload.proof.size || 0,
          hash: payload.proof.hash || 'N/A',
          metadata: payload.proof.metadata
        }
      });
    }

    return { taskId: updatedTask.id, status: 'COMPLETED' };
  }
}

export const taskService = new TaskService();
