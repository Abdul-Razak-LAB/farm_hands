import { randomBytes, scryptSync } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, createErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

const signupSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
});

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export async function POST(request: Request) {
  try {
    const input = signupSchema.parse(await request.json());
    const email = input.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('EMAIL_IN_USE', 'An account with this email already exists.', 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: input.fullName,
          hashedPassword: hashPassword(input.password),
        },
      });

      const farm = await tx.farm.create({
        data: {
          name: `${input.fullName.split(' ')[0] || 'My'} Farm`,
        },
      });

      await tx.farmMembership.create({
        data: {
          farmId: farm.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      const sessionToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

      await tx.session.create({
        data: {
          userId: user.id,
          token: sessionToken,
          expiresAt,
        },
      });

      return { user, farm, sessionToken, expiresAt };
    });

    const response = Response.json({
      success: true,
      data: {
        userId: result.user.id,
        farmId: result.farm.id,
        role: 'OWNER' as const,
        phone: input.phone || null,
      },
    });

    response.headers.append(
      'Set-Cookie',
      [
        `session_token=${result.sessionToken}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Expires=${result.expiresAt.toUTCString()}`,
        process.env.NODE_ENV === 'production' ? 'Secure' : '',
      ]
        .filter(Boolean)
        .join('; ')
    );

    return response;
  } catch (error) {
    return createErrorResponse(error);
  }
}
