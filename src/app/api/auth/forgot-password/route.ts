import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/integrations/email/provider';
import { generatePasswordResetToken, hashPasswordResetToken } from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

function buildResetLink(request: NextRequest, token: string) {
  const baseUrl = env.APP_URL || new URL(request.url).origin;
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

function resetPasswordEmailHtml(params: { resetLink: string; name: string }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Reset your FarmOSP password</h2>
      <p style="margin:0 0 12px">Hi ${params.name},</p>
      <p style="margin:0 0 16px">We received a request to reset your password. Use the link below to continue:</p>
      <p style="margin:0 0 20px"><a href="${params.resetLink}">${params.resetLink}</a></p>
      <p style="margin:0">This link expires in 1 hour. If you did not request this, ignore this email.</p>
    </div>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const input = forgotPasswordSchema.parse(await request.json());
    const email = input.email.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        email,
        memberships: {
          some: {
            role: {
              in: ['OWNER', 'MANAGER', 'WORKER'],
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (user) {
      const rawToken = generatePasswordResetToken();
      const tokenHash = hashPasswordResetToken(rawToken);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

      await prisma.$transaction(async (tx) => {
        const txPasswordResetRepo = (tx as any).passwordResetToken as {
          updateMany: (args: any) => Promise<any>;
          create: (args: any) => Promise<any>;
        };

        await txPasswordResetRepo.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });

        await txPasswordResetRepo.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });
      });

      const resetLink = buildResetLink(request, rawToken);

      await sendEmail({
        to: user.email,
        subject: 'Reset your FarmOSP password',
        html: resetPasswordEmailHtml({
          resetLink,
          name: user.name || 'there',
        }),
      });

      return Response.json({
        success: true,
        data: {
          message: 'If an account exists for this email, a reset link has been sent.',
          previewResetLink: process.env.NODE_ENV === 'production' ? undefined : resetLink,
        },
      });
    }

    return Response.json({
      success: true,
      data: {
        message: 'If an account exists for this email, a reset link has been sent.',
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
