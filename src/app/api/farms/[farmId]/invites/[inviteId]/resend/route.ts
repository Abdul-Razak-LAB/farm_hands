import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { AppError, createErrorResponse } from '@/lib/errors';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/integrations/email/provider';
import { getRequestRole, getRequestUserId } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

const invitationRepo = (prisma as any).invitation as {
  findFirst: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
};

function ensureInvitePermission(request: NextRequest) {
  if (getRequestRole(request) === 'WORKER') {
    throw new AppError('FORBIDDEN', 'Only owners and managers can resend invites.', 403);
  }
}

function buildInviteLink(request: NextRequest, token: string) {
  const baseUrl = env.APP_URL || new URL(request.url).origin;
  return `${baseUrl}/auth/invite/${token}`;
}

function inviteEmailHtml(params: { inviteLink: string; farmName: string; role: 'OWNER' | 'MANAGER' | 'WORKER' }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Your invite to ${params.farmName} was resent</h2>
      <p style="margin:0 0 12px">Your role: <strong>${params.role}</strong>.</p>
      <p style="margin:0 0 16px">Use the link below to create your account and set your password:</p>
      <p style="margin:0 0 20px"><a href="${params.inviteLink}">${params.inviteLink}</a></p>
      <p style="margin:0">If you did not expect this invite, you can ignore this email.</p>
    </div>
  `;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; inviteId: string }> }
) {
  try {
    ensureInvitePermission(request);
    const inviterUserId = getRequestUserId(request);
    const inviter = await prisma.user.findUnique({
      where: { id: inviterUserId },
      select: { id: true },
    });
    const safeInvitedByUserId = inviter?.id ?? null;
    const { farmId, inviteId } = await context.params;

    const existing = await invitationRepo.findFirst({
      where: {
        id: inviteId,
        farmId,
      },
      include: {
        farm: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!existing) {
      throw new AppError('INVITE_NOT_FOUND', 'Invitation not found.', 404);
    }

    if (existing.acceptedAt) {
      throw new AppError('INVITE_ALREADY_ACCEPTED', 'Invitation has already been accepted.', 409);
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const invitation = await invitationRepo.update({
      where: { id: existing.id },
      data: {
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
      subject: `Invite reminder: join ${existing.farm.name}`,
      html: inviteEmailHtml({
        inviteLink: buildInviteLink(request, token),
        farmName: existing.farm.name,
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
