import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { setupService } from '@/services/setup/setup-service';

const updateProfileSchema = z.object({
  action: z.literal('UPDATE_PROFILE'),
  name: z.string().min(2).optional(),
  location: z.string().optional(),
  sizeHectares: z.number().positive().optional(),
  crops: z.array(z.string().min(1)).optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

const upsertSensorSchema = z.object({
  action: z.literal('UPSERT_SENSOR'),
  sensorId: z.string().optional(),
  name: z.string().min(2),
  type: z.string().min(2),
  idempotencyKey: z.string().min(8),
});

const updateMemberRoleSchema = z.object({
  action: z.literal('UPDATE_MEMBER_ROLE'),
  membershipId: z.string().min(8),
  role: z.enum(['OWNER', 'MANAGER', 'WORKER']),
  idempotencyKey: z.string().min(8),
});

const requestSchema = z.discriminatedUnion('action', [
  updateProfileSchema,
  upsertSensorSchema,
  updateMemberRoleSchema,
]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'setup:read');
    const { farmId } = await context.params;
    const data = await setupService.getConfiguration(farmId);
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'setup:write');
    const { farmId } = await context.params;
    const userId = getRequestUserId(request);
    const input = requestSchema.parse(await request.json());

    if (input.action === 'UPDATE_PROFILE') {
      const data = await setupService.updateProfile(farmId, {
        name: input.name,
        location: input.location,
        sizeHectares: input.sizeHectares,
        crops: input.crops,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        userId,
      });
      return Response.json({ success: true, data });
    }

    if (input.action === 'UPSERT_SENSOR') {
      const data = await setupService.upsertSensor(farmId, {
        sensorId: input.sensorId,
        name: input.name,
        type: input.type,
        idempotencyKey: input.idempotencyKey,
        userId,
      });
      return Response.json({ success: true, data });
    }

    const data = await setupService.updateMembershipRole(farmId, {
      membershipId: input.membershipId,
      role: input.role,
      idempotencyKey: input.idempotencyKey,
      userId,
    });
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
