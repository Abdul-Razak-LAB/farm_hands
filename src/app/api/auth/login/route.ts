import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, createErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const passwordHash = scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(hash, 'hex');

  if (passwordHash.length !== storedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(passwordHash, storedHashBuffer);
}

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const email = input.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          orderBy: { id: 'asc' },
          take: 1,
        },
      },
    });

    if (!user || !verifyPassword(input.password, user.hashedPassword)) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new AppError('NO_FARM_ACCESS', 'No farm membership found for this account.', 403);
    }

    const sessionToken = randomBytes(32).toString('hex');
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
        `session_token=${sessionToken}`,
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
