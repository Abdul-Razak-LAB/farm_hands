import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, createErrorResponse } from '@/lib/errors';
import { hashSessionToken } from '@/lib/session-token';
import { verifyPassword } from '@/lib/password';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['OWNER', 'MANAGER', 'WORKER']),
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const email = input.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: true,
      },
    });

    if (!user || !verifyPassword(input.password, user.hashedPassword)) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    const membership = user.memberships.find((entry) => entry.role === input.role);
    if (!membership) {
      throw new AppError('ROLE_ACCESS_DENIED', `This account does not have ${input.role} access.`, 403);
    }

    const rawSessionToken = randomBytes(32).toString('hex');
    const sessionToken = hashSessionToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      },
    });

    const response = Response.json({
      success: true,
      data: {
        userId: user.id,
        farmId: membership.farmId,
        role: membership.role,
      },
    });

    response.headers.append(
      'Set-Cookie',
      [
        `session_token=${rawSessionToken}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Expires=${expiresAt.toUTCString()}`,
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
