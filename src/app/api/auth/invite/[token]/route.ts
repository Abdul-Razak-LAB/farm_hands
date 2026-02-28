import { randomBytes, scryptSync } from 'node:crypto';
import { z } from 'zod';
import { AppError, createErrorResponse } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { generateSessionToken, hashSessionToken } from '@/lib/session-token';

export const runtime = 'nodejs';

const acceptInviteSchema = z.object({
  fullName: z.string().min(2),
  password: z.string().min(8),
});

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const invitationRepo = (prisma as any).invitation as {
  findUnique: (args: any) => Promise<any>;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const invitation = await invitationRepo.findUnique({
      where: { token },
      include: {
        farm: {
          select: { name: true },
        },
      },
    });

    if (!invitation || invitation.acceptedAt) {
      throw new AppError('INVITE_INVALID', 'This invite link is invalid or already used.', 404);
    }

    if (invitation.expiresAt <= new Date()) {
      throw new AppError('INVITE_EXPIRED', 'This invite link has expired. Please request a resend.', 410);
    }

    return Response.json({
      success: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        farmId: invitation.farmId,
        farmName: invitation.farm.name,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const input = acceptInviteSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const txInvitationRepo = (tx as any).invitation as {
        findUnique: (args: any) => Promise<any>;
        update: (args: any) => Promise<any>;
      };

      const invitation = await txInvitationRepo.findUnique({
        where: { token },
      });

      if (!invitation || invitation.acceptedAt) {
        throw new AppError('INVITE_INVALID', 'This invite link is invalid or already used.', 404);
      }

      if (invitation.expiresAt <= new Date()) {
        throw new AppError('INVITE_EXPIRED', 'This invite link has expired. Please request a resend.', 410);
      }

      const existing = await tx.user.findUnique({ where: { email: invitation.email } });
      if (existing) {
        throw new AppError('EMAIL_IN_USE', 'An account with this email already exists.', 409);
      }

      const user = await tx.user.create({
        data: {
          email: invitation.email,
          name: input.fullName,
          hashedPassword: hashPassword(input.password),
        },
      });

      await tx.farmMembership.create({
        data: {
          farmId: invitation.farmId,
          userId: user.id,
          role: invitation.role,
        },
      });

      await txInvitationRepo.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      const rawSessionToken = generateSessionToken();
      const sessionToken = hashSessionToken(rawSessionToken);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

      await tx.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          expiresAt,
        },
      });

      return {
        userId: user.id,
        farmId: invitation.farmId,
        role: invitation.role,
        rawSessionToken,
        expiresAt,
      };
    });

    const response = Response.json({
      success: true,
      data: {
        userId: result.userId,
        farmId: result.farmId,
        role: result.role,
      },
    });

    response.headers.append(
      'Set-Cookie',
      [
        `session_token=${result.rawSessionToken}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Expires=${result.expiresAt.toUTCString()}`,
        process.env.NODE_ENV === 'production' ? 'Secure' : '',
      ]
        .filter(Boolean)
        .join('; '),
    );

    return response;
  } catch (error) {
    return createErrorResponse(error);
  }
}
