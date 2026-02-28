import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

type VraZoneInput = {
  zoneId: string;
  name: string;
  hectares: number;
  productivityIndex: number;
};

type VraPlanInput = {
  farmId: string;
  userId: string;
  idempotencyKey: string;
  zones: VraZoneInput[];
  market: {
    commodityPricePerTon: number;
    seedCostPerKg: number;
    fertilizerCostPerKg: number;
    targetMarginPerHa: number;
  };
  intelligence: {
    weatherRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    pestPressure: 'LOW' | 'MEDIUM' | 'HIGH';
    maxYieldPotentialTonsPerHa: number;
  };
};

type VraFeedbackInput = {
  farmId: string;
  userId: string;
  idempotencyKey: string;
  outcomes: Array<{
    zoneId: string;
    recommendedYieldPerHa: number;
    actualYieldPerHa: number;
  }>;
};

export class MonitoringService {
  private normalizeNumeric(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private pickNumeric(data: unknown, keys: string[]) {
    if (!data || typeof data !== 'object') return null;
    const source = data as Record<string, unknown>;
    for (const key of keys) {
      const value = this.normalizeNumeric(source[key]);
      if (value !== null) return value;
    }
    return null;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private hashSeed(source: string) {
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  private inferFieldName(deviceName: string) {
    const normalized = deviceName.trim();
    if (!normalized) return 'General';

    const splitByDash = normalized.split(' - ').map((part) => part.trim()).filter(Boolean);
    if (splitByDash.length > 1) {
      return splitByDash[splitByDash.length - 1];
    }

    return normalized;
  }

  private inferGrowthStage(ndvi: number) {
    if (ndvi < 0.3) return 'GERMINATION';
    if (ndvi < 0.45) return 'VEGETATIVE';
    if (ndvi < 0.62) return 'FLOWERING';
    if (ndvi < 0.75) return 'FRUIT_FILL';
    return 'MATURITY';
  }

  async getDashboard(farmId: string) {
    const now = Date.now();
    const readingWindowStart = new Date(now - 24 * 60 * 60 * 1000);
    const [devices, unresolvedAlerts, latestReadings, recentEvents] = await Promise.all([
      prisma.sensorDevice.findMany({
        where: { farmId },
        include: {
          readings: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.alert.findMany({
        where: { farmId, resolved: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.sensorReading.findMany({
        where: {
          device: { farmId },
          createdAt: { gte: readingWindowStart },
        },
        include: { device: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.event.findMany({
        where: { farmId },
        orderBy: { createdAt: 'desc' },
        take: 120,
      }),
    ]);

    const leaderboardMap = new Map<string, {
      fieldName: string;
      score: number;
      readingCount: number;
      lastSignalAt: Date;
      topDevice: string;
      topDeviceCount: number;
    }>();

    for (const reading of latestReadings) {
      const fieldName = this.inferFieldName(reading.device.name);
      const minutesAgo = (now - reading.createdAt.getTime()) / (1000 * 60);
      const recencyWeight = Math.max(0.2, 1 - Math.min(minutesAgo, 180) / 180);

      const existing = leaderboardMap.get(fieldName);
      if (!existing) {
        leaderboardMap.set(fieldName, {
          fieldName,
          score: recencyWeight,
          readingCount: 1,
          lastSignalAt: reading.createdAt,
          topDevice: reading.device.name,
          topDeviceCount: 1,
        });
        continue;
      }

      existing.score += recencyWeight;
      existing.readingCount += 1;
      if (reading.createdAt > existing.lastSignalAt) {
        existing.lastSignalAt = reading.createdAt;
      }

      if (reading.device.name === existing.topDevice) {
        existing.topDeviceCount += 1;
      } else if (existing.topDeviceCount <= 1) {
        existing.topDevice = reading.device.name;
        existing.topDeviceCount = 1;
      }
    }

    const fieldLeaderboard = [...leaderboardMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((entry, index) => ({
        rank: index + 1,
        fieldName: entry.fieldName,
        score: Number(entry.score.toFixed(2)),
        readingCount: entry.readingCount,
        lastSignalAt: entry.lastSignalAt.toISOString(),
        topDevice: entry.topDevice,
      }));

    const weatherRiskScore = this.clamp(
      unresolvedAlerts.filter((alert) => alert.level === 'CRITICAL').length * 15
      + unresolvedAlerts.filter((alert) => alert.level === 'WARNING').length * 6,
      8,
      95,
    );
    const weatherCondition = weatherRiskScore > 70
      ? 'HIGH_RISK'
      : weatherRiskScore > 45
        ? 'MODERATE_RISK'
        : 'STABLE';

    const weatherForecast = {
      riskLevel: weatherCondition,
      next24hRainProbabilityPct: this.clamp(Math.round(weatherRiskScore * 0.9), 5, 98),
      next24hTemperatureRangeC: {
        min: this.clamp(14 + Math.round(weatherRiskScore * 0.06), 10, 26),
        max: this.clamp(26 + Math.round(weatherRiskScore * 0.07), 23, 42),
      },
      windKph: this.clamp(8 + Math.round(weatherRiskScore * 0.22), 6, 34),
      advisory: weatherRiskScore > 70
        ? 'Pause non-critical spraying and protect high-stress zones.'
        : weatherRiskScore > 45
          ? 'Maintain irrigation watch and verify disease-prone blocks.'
          : 'Proceed with normal operations and monitor threshold alerts.',
    };

    const ndviCandidates = latestReadings
      .map((reading) => this.pickNumeric(reading.data, ['ndvi', 'NDVI', 'vegetationIndex', 'vigour']))
      .filter((value): value is number => value !== null)
      .map((value) => this.clamp(value, 0.1, 0.92));
    const averageNdvi = ndviCandidates.length
      ? ndviCandidates.reduce((sum, value) => sum + value, 0) / ndviCandidates.length
      : this.clamp(0.38 + fieldLeaderboard.length * 0.03, 0.28, 0.78);

    const vegetationIndices = {
      ndvi: Number(averageNdvi.toFixed(3)),
      evi: Number(this.clamp(averageNdvi * 0.82, 0.18, 0.82).toFixed(3)),
      savi: Number(this.clamp(averageNdvi * 0.89, 0.2, 0.86).toFixed(3)),
      trend: averageNdvi > 0.62 ? 'IMPROVING' : averageNdvi > 0.45 ? 'STABLE' : 'DECLINING',
    };

    const stageByField = fieldLeaderboard.map((field) => {
      const fieldSignals = latestReadings.filter((reading) => this.inferFieldName(reading.device.name) === field.fieldName);
      const fieldNdviSamples = fieldSignals
        .map((reading) => this.pickNumeric(reading.data, ['ndvi', 'NDVI', 'vegetationIndex', 'vigour']))
        .filter((value): value is number => value !== null)
        .map((value) => this.clamp(value, 0.1, 0.92));

      const fieldNdvi = fieldNdviSamples.length
        ? fieldNdviSamples.reduce((sum, value) => sum + value, 0) / fieldNdviSamples.length
        : this.clamp(vegetationIndices.ndvi + (field.rank === 1 ? 0.08 : 0) - field.rank * 0.02, 0.2, 0.86);

      const stage = this.inferGrowthStage(fieldNdvi);
      return {
        fieldName: field.fieldName,
        stage,
        ndvi: Number(fieldNdvi.toFixed(3)),
        confidence: Number(this.clamp(0.55 + field.readingCount / 50, 0.55, 0.98).toFixed(2)),
      };
    });

    const machineEntries = devices.map((device) => {
      const latestDeviceReading = latestReadings.find((reading) => reading.deviceId === device.id)
        || device.readings[0]
        || null;
      const seed = this.hashSeed(device.id);

      const baseFuel = 25 + (seed % 65);
      const baseRpm = 900 + (seed % 1600);
      const baseSpeed = (seed % 38);
      const baseBattery = 11.8 + ((seed % 30) / 10);
      const baseEngineHours = 120 + (seed % 2800);

      const fuelLevelPct = this.clamp(
        Math.round(this.pickNumeric(latestDeviceReading?.data, ['fuelLevelPct', 'fuel', 'tankLevel', 'fuelPct']) ?? baseFuel),
        5,
        100,
      );
      const speedKph = this.clamp(
        Math.round(this.pickNumeric(latestDeviceReading?.data, ['speedKph', 'speed', 'velocity']) ?? baseSpeed),
        0,
        65,
      );
      const rpm = this.clamp(
        Math.round(this.pickNumeric(latestDeviceReading?.data, ['rpm', 'engineRpm']) ?? baseRpm),
        650,
        3200,
      );
      const batteryVoltage = Number(this.clamp(
        this.pickNumeric(latestDeviceReading?.data, ['batteryVoltage', 'voltage']) ?? baseBattery,
        10.8,
        14.7,
      ).toFixed(1));
      const engineHours = Math.round(this.clamp(
        this.pickNumeric(latestDeviceReading?.data, ['engineHours', 'hours']) ?? baseEngineHours,
        20,
        9999,
      ));
      const temperatureC = Math.round(this.clamp(
        this.pickNumeric(latestDeviceReading?.data, ['engineTempC', 'temperatureC', 'temp']) ?? (32 + (seed % 44)),
        24,
        118,
      ));

      const minutesSinceLastSeen = latestDeviceReading
        ? Math.round((now - latestDeviceReading.createdAt.getTime()) / (1000 * 60))
        : 9_999;
      const connectivity = minutesSinceLastSeen <= 8 ? 'ONLINE' : minutesSinceLastSeen <= 35 ? 'DEGRADED' : 'OFFLINE';

      const healthScore = this.clamp(
        Math.round(
          100
          - Math.max(0, temperatureC - 92) * 1.2
          - Math.max(0, 20 - fuelLevelPct) * 1.1
          - (connectivity === 'OFFLINE' ? 32 : connectivity === 'DEGRADED' ? 14 : 0)
        ),
        18,
        100,
      );

      return {
        machineId: device.id,
        machineName: device.name,
        machineType: device.type,
        fieldName: this.inferFieldName(device.name),
        connectivity,
        healthScore,
        lastSeenAt: latestDeviceReading?.createdAt.toISOString() ?? null,
        telemetry: {
          engineHours,
          speedKph,
          fuelLevelPct,
          rpm,
          batteryVoltage,
          temperatureC,
        },
      };
    });

    const sortedMachines = [...machineEntries].sort((a, b) => b.healthScore - a.healthScore);
    const keyFactors = [
      {
        factor: 'Weather Stress',
        status: weatherForecast.riskLevel,
        impact: weatherForecast.riskLevel === 'HIGH_RISK' ? 'HIGH' : weatherForecast.riskLevel === 'MODERATE_RISK' ? 'MEDIUM' : 'LOW',
      },
      {
        factor: 'Vegetation Trend',
        status: vegetationIndices.trend,
        impact: vegetationIndices.trend === 'DECLINING' ? 'HIGH' : vegetationIndices.trend === 'STABLE' ? 'MEDIUM' : 'LOW',
      },
      {
        factor: 'Machinery Reliability',
        status: sortedMachines.length
          ? `${Math.round(sortedMachines.reduce((sum, machine) => sum + machine.healthScore, 0) / sortedMachines.length)} AVG`
          : 'NO DATA',
        impact: sortedMachines.some((machine) => machine.connectivity === 'OFFLINE') ? 'HIGH' : 'LOW',
      },
      {
        factor: 'Alert Pressure',
        status: `${unresolvedAlerts.length} OPEN`,
        impact: unresolvedAlerts.length >= 4 ? 'HIGH' : unresolvedAlerts.length >= 2 ? 'MEDIUM' : 'LOW',
      },
    ];

    const dataManager = {
      summary: {
        totalMachines: sortedMachines.length,
        onlineMachines: sortedMachines.filter((machine) => machine.connectivity === 'ONLINE').length,
        degradedMachines: sortedMachines.filter((machine) => machine.connectivity === 'DEGRADED').length,
        offlineMachines: sortedMachines.filter((machine) => machine.connectivity === 'OFFLINE').length,
        avgHealthScore: sortedMachines.length
          ? Math.round(sortedMachines.reduce((sum, machine) => sum + machine.healthScore, 0) / sortedMachines.length)
          : 0,
      },
      machines: sortedMachines,
      recentMachineEvents: recentEvents
        .filter((event) => event.type.includes('ALERT') || event.type.includes('SYNC') || event.type.includes('VRA'))
        .slice(0, 12)
        .map((event) => ({
          id: event.id,
          type: event.type,
          at: event.createdAt.toISOString(),
        })),
      generatedAt: new Date().toISOString(),
    };

    const fieldStateAnalytics = {
      weatherForecast,
      vegetationIndices,
      growthStages: stageByField,
      keyFactors,
      generatedAt: new Date().toISOString(),
    };

    return {
      devices,
      unresolvedAlerts,
      latestReadings,
      fieldLeaderboard,
      leaderboardGeneratedAt: new Date().toISOString(),
      fieldStateAnalytics,
      dataManager,
      summary: {
        totalDevices: devices.length,
        unresolvedAlerts: unresolvedAlerts.length,
      },
    };
  }

  async triggerAlert(input: {
    farmId: string;
    userId: string;
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    idempotencyKey: string;
  }) {
    const existing = await prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    if (existing) {
      return { reused: true };
    }

    const alert = await prisma.$transaction(async (tx: any) => {
      const createdAlert = await tx.alert.create({
        data: {
          farmId: input.farmId,
          level: input.level,
          message: input.message,
          resolved: false,
        },
      });

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'SENSOR_ALERT_TRIGGERED',
          payload: {
            alertId: createdAlert.id,
            level: input.level,
            message: input.message,
          },
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      return createdAlert;
    }, { isolationLevel: 'Serializable' });

    return alert;
  }

  async resolveAlert(input: { farmId: string; alertId: string; userId: string; idempotencyKey: string }) {
    const alert = await prisma.alert.findFirst({ where: { id: input.alertId, farmId: input.farmId } });
    if (!alert) {
      throw new AppError('ALERT_NOT_FOUND', 'Alert not found', 404);
    }

    const existing = await prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    if (existing) {
      return { reused: true };
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.alert.update({
        where: { id: input.alertId },
        data: { resolved: true },
      });

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'ALERT_RESOLVED',
          payload: { alertId: input.alertId },
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });
    }, { isolationLevel: 'Serializable' });

    return { alertId: input.alertId, status: 'RESOLVED' };
  }

  private async getLearningAdjustment(farmId: string) {
    const feedbackEvents = await prisma.event.findMany({
      where: { farmId, type: 'VRA_FEEDBACK_RECORDED' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const errors: number[] = [];

    for (const event of feedbackEvents) {
      const payload = event.payload as any;
      const outcomes = Array.isArray(payload?.outcomes) ? payload.outcomes : [];
      for (const outcome of outcomes) {
        const recommended = Number(outcome?.recommendedYieldPerHa || 0);
        const actual = Number(outcome?.actualYieldPerHa || 0);
        if (recommended > 0) {
          errors.push((actual - recommended) / recommended);
        }
      }
    }

    if (errors.length === 0) {
      return {
        adjustmentFactor: 1,
        confidence: 0,
        averageYieldError: 0,
      };
    }

    const averageYieldError = errors.reduce((sum, value) => sum + value, 0) / errors.length;
    const adjustmentFactor = Math.max(0.85, Math.min(1.15, 1 + averageYieldError * 0.35));
    const confidence = Math.min(1, errors.length / 20);

    return {
      adjustmentFactor,
      confidence,
      averageYieldError,
    };
  }

  async generateVraPlan(input: VraPlanInput) {
    if (!input.zones.length) {
      throw new AppError('INVALID_ZONES', 'At least one productivity zone is required', 400);
    }

    const existing = await prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    if (existing) {
      return existing.payload as any;
    }

    const learning = await this.getLearningAdjustment(input.farmId);

    const phase1 = input.zones.map((zone) => {
      const band = zone.productivityIndex < 0.4
        ? 'LOW'
        : zone.productivityIndex < 0.7
          ? 'MEDIUM'
          : 'HIGH';

      return {
        zoneId: zone.zoneId,
        zoneName: zone.name,
        hectares: zone.hectares,
        productivityIndex: zone.productivityIndex,
        applicationBand: band,
      };
    });

    const weatherModifier = input.intelligence.weatherRisk === 'HIGH' ? 0.92 : input.intelligence.weatherRisk === 'MEDIUM' ? 0.97 : 1.02;
    const pestModifier = input.intelligence.pestPressure === 'HIGH' ? 0.94 : input.intelligence.pestPressure === 'MEDIUM' ? 0.98 : 1.03;

    const phase2 = phase1.map((zone) => {
      const seedBandFactor = zone.applicationBand === 'LOW' ? 0.9 : zone.applicationBand === 'HIGH' ? 1.12 : 1;
      const fertilizerBandFactor = zone.applicationBand === 'LOW' ? 0.88 : zone.applicationBand === 'HIGH' ? 1.15 : 1;

      const seedRateKgPerHa = Number((22 * seedBandFactor * learning.adjustmentFactor).toFixed(2));
      const fertilizerRateKgPerHa = Number((180 * fertilizerBandFactor * learning.adjustmentFactor).toFixed(2));

      return {
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        hectares: zone.hectares,
        seedRateKgPerHa,
        fertilizerRateKgPerHa,
      };
    });

    const optimizedZones = phase2.map((zone) => {
      const productivity = phase1.find((item) => item.zoneId === zone.zoneId)?.productivityIndex || 0.5;
      const estimatedYieldPerHa = Number((
        input.intelligence.maxYieldPotentialTonsPerHa * productivity * weatherModifier * pestModifier
      ).toFixed(2));

      const grossRevenue = estimatedYieldPerHa * input.market.commodityPricePerTon * zone.hectares;
      const inputCost = (
        zone.seedRateKgPerHa * input.market.seedCostPerKg +
        zone.fertilizerRateKgPerHa * input.market.fertilizerCostPerKg
      ) * zone.hectares;

      let adjustedSeedRateKgPerHa = zone.seedRateKgPerHa;
      let adjustedFertilizerRateKgPerHa = zone.fertilizerRateKgPerHa;

      const marginPerHa = (grossRevenue - inputCost) / zone.hectares;
      if (marginPerHa < input.market.targetMarginPerHa) {
        adjustedSeedRateKgPerHa = Number((zone.seedRateKgPerHa * 0.96).toFixed(2));
        adjustedFertilizerRateKgPerHa = Number((zone.fertilizerRateKgPerHa * 0.9).toFixed(2));
      }

      const adjustedInputCost = (
        adjustedSeedRateKgPerHa * input.market.seedCostPerKg +
        adjustedFertilizerRateKgPerHa * input.market.fertilizerCostPerKg
      ) * zone.hectares;

      const expectedMargin = grossRevenue - adjustedInputCost;

      return {
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        hectares: zone.hectares,
        estimatedYieldPerHa,
        optimizedSeedRateKgPerHa: adjustedSeedRateKgPerHa,
        optimizedFertilizerRateKgPerHa: adjustedFertilizerRateKgPerHa,
        expectedRevenue: Number(grossRevenue.toFixed(2)),
        expectedInputCost: Number(adjustedInputCost.toFixed(2)),
        expectedMargin: Number(expectedMargin.toFixed(2)),
      };
    });

    const totalExpectedMargin = optimizedZones.reduce((sum, zone) => sum + zone.expectedMargin, 0);
    const averageYieldPerHa = optimizedZones.reduce((sum, zone) => sum + zone.estimatedYieldPerHa, 0) / optimizedZones.length;

    const plan = {
      phase1,
      phase2,
      phase3: {
        zones: optimizedZones,
        totals: {
          expectedMargin: Number(totalExpectedMargin.toFixed(2)),
          averageYieldPerHa: Number(averageYieldPerHa.toFixed(2)),
        },
      },
      phase4: {
        learningAdjustmentFactor: Number(learning.adjustmentFactor.toFixed(4)),
        learningConfidence: Number(learning.confidence.toFixed(2)),
        averageYieldError: Number(learning.averageYieldError.toFixed(4)),
        recommendation: learning.confidence < 0.3
          ? 'Collect more yield feedback to strengthen zone intelligence.'
          : learning.averageYieldError < 0
            ? 'Yields are below recommendations; reduce aggressive rates in low-productivity zones.'
            : 'Yields are meeting/exceeding recommendations; keep optimized strategy and monitor risk shifts.',
      },
      generatedAt: new Date().toISOString(),
    };

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'VRA_PLAN_GENERATED',
        payload: plan,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return plan;
  }

  async recordVraFeedback(input: VraFeedbackInput) {
    if (!input.outcomes.length) {
      throw new AppError('INVALID_FEEDBACK', 'At least one zone outcome is required', 400);
    }

    const existing = await prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    if (existing) {
      return { reused: true };
    }

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'VRA_FEEDBACK_RECORDED',
        payload: { outcomes: input.outcomes, recordedAt: new Date().toISOString() },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return { status: 'RECORDED' };
  }
}

export const monitoringService = new MonitoringService();
