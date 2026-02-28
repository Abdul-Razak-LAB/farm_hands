import { NextRequest } from 'next/server';
import { AppError } from './errors';

export type FarmPermission =
  | 'finance:read'
  | 'finance:write'
  | 'finance:approve'
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

type FarmRole = 'OWNER' | 'MANAGER' | 'WORKER';

const roleMatrix: Record<FarmRole, FarmPermission[]> = {
  OWNER: [
    'finance:read',
    'finance:write',
    'finance:approve',
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
    'finance:read',
    'finance:write',
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
  WORKER: ['updates:read', 'updates:write', 'incident:read', 'incident:write', 'procurement:read'],
};

export function getRequestRole(request: NextRequest): FarmRole {
  const headerRole = request.headers.get('x-farm-role');
  if (headerRole === 'OWNER' || headerRole === 'MANAGER' || headerRole === 'WORKER') {
    return headerRole;
  }

  return 'MANAGER';
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
