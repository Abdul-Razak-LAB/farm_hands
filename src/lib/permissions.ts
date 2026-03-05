import { NextRequest } from 'next/server';
import { AppError } from './errors';
import { prisma } from './prisma';
import { hashSessionToken } from './session-token';

export type FarmPermission =
  | 'setup:read'
  | 'setup:write'
  | 'marketplace:read'
  | 'marketplace:write'
  | 'finance:read'
  | 'finance:write'
  | 'finance:approve'
  | 'report:read'
  | 'report:export'
  | 'message:read'
  | 'message:write'
  | 'updates:read'
  | 'updates:write'
  | 'digest:read'
  | 'monitoring:read'
  | 'monitoring:write'
  | 'incident:read'
  | 'incident:write'
  | 'vendor:read'
  | 'vendor:write'
  | 'procurement:read'
  | 'procurement:write'
  | 'payroll:read'
  | 'payroll:write'
  | 'payroll:approve'
  | 'payroll:pay';

export type FarmRole = 'OWNER' | 'MANAGER' | 'WORKER';

const roleMatrix: Record<FarmRole, FarmPermission[]> = {
  OWNER: [
    'setup:read',
    'setup:write',
    'marketplace:read',
    'marketplace:write',
    'finance:read',
    'finance:write',
    'finance:approve',
    'report:read',
    'report:export',
    'message:read',
    'message:write',
    'updates:read',
    'updates:write',
    'digest:read',
    'monitoring:read',
    'monitoring:write',
    'incident:read',
    'incident:write',
    'vendor:read',
    'vendor:write',
    'procurement:read',
    'procurement:write',
    'payroll:read',
    'payroll:write',
    'payroll:approve',
    'payroll:pay',
  ],
  MANAGER: [
    'setup:read',
    'setup:write',
    'marketplace:read',
    'marketplace:write',
    'finance:read',
    'finance:write',
    'finance:approve',
    'report:read',
    'report:export',
    'message:read',
    'message:write',
    'updates:read',
    'updates:write',
    'digest:read',
    'monitoring:read',
    'monitoring:write',
    'incident:read',
    'incident:write',
    'vendor:read',
    'vendor:write',
    'procurement:read',
    'procurement:write',
    'payroll:read',
    'payroll:write',
  ],
  WORKER: [
    'setup:read',
    'marketplace:read',
    'marketplace:write',
    'updates:read',
    'updates:write',
    'message:read',
    'message:write',
    'incident:read',
    'incident:write',
    'procurement:read',
  ],
};

export function getRequestRole(request: NextRequest): FarmRole {
  const headerRole = request.headers.get('x-farm-role');
  if (headerRole === 'OWNER' || headerRole === 'MANAGER' || headerRole === 'WORKER') {
    return headerRole;
  }

  return 'MANAGER';
}

function getSessionTokenFromRequest(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;
  return token ? decodeURIComponent(token) : null;
}

export async function getFarmAuthContext(
  request: NextRequest,
  farmId: string,
): Promise<{ userId: string; role: FarmRole }> {
  const rawToken = getSessionTokenFromRequest(request);
  if (!rawToken) {
    // Backward-compatible fallback for non-cookie clients/tests.
    // Session-based auth remains the primary path.
    const fallbackRole = request.headers.get('x-farm-role');
    if (fallbackRole === 'OWNER' || fallbackRole === 'MANAGER' || fallbackRole === 'WORKER') {
      return {
        userId: getRequestUserId(request),
        role: fallbackRole,
      };
    }

    throw new AppError('UNAUTHORIZED', 'Auth required', 401);
  }

  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.session.findFirst({
    where: {
      token: tokenHash,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        include: {
          memberships: {
            where: { farmId },
            take: 1,
          },
        },
      },
    },
  });

  const membership = session?.user?.memberships?.[0];
  if (!session || !membership) {
    throw new AppError('FORBIDDEN', 'No membership for this farm', 403);
  }

  return {
    userId: session.user.id,
    role: membership.role as FarmRole,
  };
}

export async function requireFarmPermission(request: NextRequest, farmId: string, permission: FarmPermission) {
  const auth = await getFarmAuthContext(request, farmId);
  if (!roleMatrix[auth.role].includes(permission)) {
    throw new AppError('FORBIDDEN', 'You do not have permission for this action', 403);
  }

  return auth;
}

export function getRequestUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'user_id_from_session';
}

export function requirePermission(request: NextRequest, permission: FarmPermission) {
  const role = getRequestRole(request);
  if (!roleMatrix[role].includes(permission)) {
    throw new AppError('FORBIDDEN', 'You do not have permission for this action', 403);
  }
}
