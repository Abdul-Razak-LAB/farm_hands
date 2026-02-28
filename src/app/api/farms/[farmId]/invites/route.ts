import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, createErrorResponse } from '@/lib/errors';
import { sendEmail } from '@/lib/integrations/email/provider';
import { getRequestRole, getRequestUserId } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

const invitationRepo = (prisma as any).invitation as {
  findMany: (args: any) => Promise<any[]>;
  upsert: (args: any) => Promise<any>;
};

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'MANAGER', 'WORKER']),
});

function ensureInvitePermission(request: NextRequest) {
  if (getRequestRole(request) === 'WORKER') {
    throw new AppError('FORBIDDEN', 'Only owners and managers can invite users.', 403);
  }
}

function buildInviteLink(request: NextRequest, token: string) {
  const baseUrl = env.APP_URL || new URL(request.url).origin;
  return `${baseUrl}/auth/invite/${token}`;
}

function inviteEmailHtml(params: { inviteLink: string; farmName: string; role: 'OWNER' | 'MANAGER' | 'WORKER' }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">You are invited to ${params.farmName}</h2>
      <p style="margin:0 0 12px">You were invited as a <strong>${params.role}</strong>.</p>
      <p style="margin:0 0 16px">Click the link below to create your account and set your password:</p>
      <p style="margin:0 0 20px"><a href="${params.inviteLink}">${params.inviteLink}</a></p>
      <p style="margin:0">If you did not expect this invite, you can ignore this email.</p>
    </div>
  `;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    ensureInvitePermission(request);
    const { farmId } = await context.params;

    const invitations = await invitationRepo.findMany({
      where: {
        farmId,
        acceptedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return Response.json({ success: true, data: invitations });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    ensureInvitePermission(request);
    const { farmId } = await context.params;
    const input = inviteSchema.parse(await request.json());
    const inviterUserId = getRequestUserId(request);
    const email = input.email.toLowerCase();
    const inviter = await prisma.user.findUnique({
      where: { id: inviterUserId },
      select: { id: true },
    });
    const safeInvitedByUserId = inviter?.id ?? null;

    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: { name: true },
    });

    if (!farm) {
      throw new AppError('FARM_NOT_FOUND', 'Farm not found.', 404);
    }

    const userWithMembership = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { farmId },
          take: 1,
        },
      },
    });

    if (userWithMembership?.memberships.length) {
      throw new AppError('ALREADY_MEMBER', 'This email already has access to this farm.', 409);
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const invitation = await invitationRepo.upsert({
      where: {
        farmId_email: {
          farmId,
          email,
        },
      },
      update: {
        role: input.role,
        token,
        expiresAt,
        acceptedAt: null,
        invitedByUserId: safeInvitedByUserId,
      },
      create: {
        farmId,
        email,
        role: input.role,
        token,
        expiresAt,
        invitedByUserId: safeInvitedByUserId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
      },
    });

    await sendEmail({
      to: invitation.email,
      subject: `You are invited to join ${farm.name}`,
      html: inviteEmailHtml({
        inviteLink: buildInviteLink(request, token),
        farmName: farm.name,
        role: invitation.role,
      }),
    });

    return Response.json({
      success: true,
      data: {
        ...invitation,
        sent: true,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
