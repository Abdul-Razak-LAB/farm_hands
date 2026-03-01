import { AppError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export type FarmProfileInput = {
  name?: string;
  location?: string;
  sizeHectares?: number;
  crops?: string[];
  notes?: string;
  idempotencyKey: string;
  userId: string;
};

export type SensorConfigInput = {
  sensorId?: string;
  name: string;
  type: string;
  idempotencyKey: string;
  userId: string;
};

export type MembershipRoleInput = {
  membershipId: string;
  role: 'OWNER' | 'MANAGER' | 'WORKER';
  idempotencyKey: string;
  userId: string;
};

export class SetupService {
  private async ensureEventIdempotency(farmId: string, idempotencyKey: string) {
    const existing = await prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId,
          idempotencyKey,
        },
      },
    });

    return existing;
  }

  async getConfiguration(farmId: string) {
    const [farm, memberships, sensors, latestProfileEvent, recentReadings] = await Promise.all([
      prisma.farm.findUnique({ where: { id: farmId } }),
      prisma.farmMembership.findMany({
        where: { farmId },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { id: 'asc' },
      }),
      prisma.sensorDevice.findMany({
        where: { farmId },
        orderBy: { name: 'asc' },
      }),
      prisma.event.findFirst({
        where: { farmId, type: 'FARM_PROFILE_UPDATED' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sensorReading.findMany({
        where: {
          device: { farmId },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
    ]);

    if (!farm) {
      throw new AppError('FARM_NOT_FOUND', 'Farm not found', 404);
    }

    const profilePayload = (latestProfileEvent?.payload as Record<string, unknown> | null) ?? null;
    const latestReadingByDevice = new Map<string, Date>();
    for (const reading of recentReadings) {
      if (!latestReadingByDevice.has(reading.deviceId)) {
        latestReadingByDevice.set(reading.deviceId, reading.createdAt);
      }
    }

    return {
      profile: {
        id: farm.id,
        name: farm.name,
        location: typeof profilePayload?.location === 'string' ? profilePayload.location : '',
        sizeHectares: typeof profilePayload?.sizeHectares === 'number' ? profilePayload.sizeHectares : null,
        crops: Array.isArray(profilePayload?.crops) ? profilePayload?.crops : [],
        notes: typeof profilePayload?.notes === 'string' ? profilePayload.notes : '',
        updatedAt: latestProfileEvent?.createdAt?.toISOString() ?? farm.updatedAt.toISOString(),
      },
      sensors: sensors.map((sensor) => ({
        id: sensor.id,
        name: sensor.name,
        type: sensor.type,
        lastReadingAt: latestReadingByDevice.get(sensor.id)?.toISOString() ?? null,
      })),
      members: memberships.map((membership) => ({
        membershipId: membership.id,
        userId: membership.userId,
        role: membership.role,
        user: membership.user,
      })),
    };
  }

  async updateProfile(farmId: string, input: FarmProfileInput) {
    const existing = await this.ensureEventIdempotency(farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true, eventId: existing.id };
    }

    const farm = await prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new AppError('FARM_NOT_FOUND', 'Farm not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      if (input.name && input.name.trim() && input.name.trim() !== farm.name) {
        await tx.farm.update({
          where: { id: farmId },
          data: { name: input.name.trim() },
        });
      }

      await tx.event.create({
        data: {
          farmId,
          type: 'FARM_PROFILE_UPDATED',
          payload: {
            location: input.location?.trim() ?? '',
            sizeHectares: input.sizeHectares ?? null,
            crops: input.crops ?? [],
            notes: input.notes?.trim() ?? '',
            name: input.name?.trim() ?? farm.name,
          },
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
        },
      });
    }, { isolationLevel: 'Serializable' });

    return { status: 'UPDATED' };
  }

  async upsertSensor(farmId: string, input: SensorConfigInput) {
    const existing = await this.ensureEventIdempotency(farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true, eventId: existing.id };
    }

    const sensor = input.sensorId
      ? await prisma.sensorDevice.update({
          where: { id: input.sensorId },
          data: {
            name: input.name.trim(),
            type: input.type.trim().toUpperCase(),
          },
        })
      : await prisma.sensorDevice.create({
          data: {
            farmId,
            name: input.name.trim(),
            type: input.type.trim().toUpperCase(),
          },
        });

    await prisma.event.create({
      data: {
        farmId,
        type: 'SENSOR_DEVICE_CONFIGURED',
        payload: {
          sensorId: sensor.id,
          name: sensor.name,
          type: sensor.type,
          operation: input.sensorId ? 'UPDATE' : 'CREATE',
        },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return sensor;
  }

  async updateMembershipRole(farmId: string, input: MembershipRoleInput) {
    const existing = await this.ensureEventIdempotency(farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true, eventId: existing.id };
    }

    const membership = await prisma.farmMembership.findFirst({
      where: { id: input.membershipId, farmId },
    });

    if (!membership) {
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'Membership not found for this farm', 404);
    }

    const updated = await prisma.farmMembership.update({
      where: { id: membership.id },
      data: { role: input.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    await prisma.event.create({
      data: {
        farmId,
        type: 'MEMBERSHIP_ROLE_UPDATED',
        payload: {
          membershipId: updated.id,
          userId: updated.userId,
          role: updated.role,
        },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return {
      membershipId: updated.id,
      userId: updated.userId,
      role: updated.role,
      user: updated.user,
    };
  }
}

export const setupService = new SetupService();
