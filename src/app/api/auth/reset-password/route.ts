import { z } from 'zod';
import { AppError, createErrorResponse } from '@/lib/errors';
import { hashPassword } from '@/lib/password';
import { hashPasswordResetToken } from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8),
});

const passwordResetRepo = (prisma as any).passwordResetToken as {
  findUnique: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
};

export async function POST(request: Request) {
  try {
    const input = resetPasswordSchema.parse(await request.json());
    const tokenHash = hashPasswordResetToken(input.token);

    const resetToken = await passwordResetRepo.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new AppError('RESET_TOKEN_INVALID', 'This reset link is invalid or has expired.', 400);
    }

    await prisma.$transaction(async (tx) => {
      const txPasswordResetRepo = (tx as any).passwordResetToken as {
        update: (args: any) => Promise<any>;
      };

      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          hashedPassword: hashPassword(input.password),
        },
      });

      await txPasswordResetRepo.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      await tx.session.deleteMany({
        where: { userId: resetToken.userId },
      });
    });

    return Response.json({
      success: true,
      data: {
        message: 'Password updated. Please sign in with your new password.',
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
