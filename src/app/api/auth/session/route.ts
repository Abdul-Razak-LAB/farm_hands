import { prisma } from '@/lib/prisma';
import { AppError, createErrorResponse } from '@/lib/errors';
import { hashSessionToken } from '@/lib/session-token';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const tokenPart = cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('session_token='));

    const rawToken = tokenPart?.split('=')[1];
    if (!rawToken) {
      throw new AppError('UNAUTHORIZED', 'No active session.', 401);
    }

    const tokenHash = hashSessionToken(decodeURIComponent(rawToken));
    const session = await prisma.session.findFirst({
      where: {
        token: tokenHash,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            memberships: {
              orderBy: { id: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!session || !session.user.memberships[0]) {
      throw new AppError('UNAUTHORIZED', 'Session is invalid or expired.', 401);
    }

    const membership = session.user.memberships[0];

    return Response.json({
      success: true,
      data: {
        userId: session.user.id,
        farmId: membership.farmId,
        role: membership.role,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
