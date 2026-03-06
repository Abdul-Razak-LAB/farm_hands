import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, createErrorResponse } from '@/lib/errors';
import { hashSessionToken } from '@/lib/session-token';

export const runtime = 'nodejs';

const createFarmSchema = z.object({
  name: z.string().min(2).max(80),
});

async function getSessionUser(request: NextRequest) {
  const rawToken = request.cookies.get('session_token')?.value;
  if (!rawToken) {
    throw new AppError('UNAUTHORIZED', 'No active session.', 401);
  }

  const tokenHash = hashSessionToken(decodeURIComponent(rawToken));
  const session = await prisma.session.findFirst({
    where: {
      token: tokenHash,
      expiresAt: { gt: new Date() },
    },
    select: {
      userId: true,
    },
  });

  if (!session) {
    throw new AppError('UNAUTHORIZED', 'Session is invalid or expired.', 401);
  }

  return session.userId;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUser(request);

    const memberships = await prisma.farmMembership.findMany({
      where: { userId },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    return Response.json({
      success: true,
      data: memberships.map((membership) => ({
        farmId: membership.farm.id,
        name: membership.farm.name,
        role: membership.role,
        createdAt: membership.farm.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUser(request);
    const input = createFarmSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const farm = await tx.farm.create({
        data: {
          name: input.name.trim(),
        },
      });

      await tx.farmMembership.create({
        data: {
          farmId: farm.id,
          userId,
          role: 'OWNER',
        },
      });

      await tx.event.create({
        data: {
          farmId: farm.id,
          type: 'FARM_CREATED',
          payload: {
            name: farm.name,
          },
          userId,
          idempotencyKey: `farm:create:${farm.id}`,
        },
      });

      return farm;
    });

    return Response.json({
      success: true,
      data: {
        farmId: result.id,
        name: result.name,
        role: 'OWNER' as const,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
