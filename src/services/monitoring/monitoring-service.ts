import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

type DailyWeatherForecast = {
  date: string;
  summary: string;
  riskLevel: 'STABLE' | 'MODERATE_RISK' | 'HIGH_RISK';
  rainProbabilityPct: number;
  windKph: number;
  temperatureMinC: number;
  temperatureMaxC: number;
};

type WeatherForecastPayload = {
  source: 'OPEN_METEO' | 'SYNTHETIC';
  location: {
    label: string;
    latitude: number;
    longitude: number;
    timezone: string;
  } | null;
  riskLevel: 'STABLE' | 'MODERATE_RISK' | 'HIGH_RISK';
  next24hRainProbabilityPct: number;
  next24hRainMm: number;
  next24hTemperatureRangeC: {
    min: number;
    max: number;
  };
  windKph: number;
  advisory: string;
  daily: DailyWeatherForecast[];
};

type ResolvedFarmLocation = {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

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
  private locationCache = new Map<string, { expiresAt: number; value: ResolvedFarmLocation | null }>();

  private forecastCache = new Map<string, { expiresAt: number; value: WeatherForecastPayload }>();

  private weatherCodeSummary(code: number) {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Cloudy';
    if (code === 45 || code === 48) return 'Fog';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
    if ([61, 63, 65, 66, 67].includes(code)) return 'Rain';
    if ([71, 73, 75, 77].includes(code)) return 'Snow';
    if ([80, 81, 82].includes(code)) return 'Showers';
    if ([95, 96, 99].includes(code)) return 'Thunderstorm';
    return 'Mixed';
  }

  private riskFromWeather(rainProbabilityPct: number, windKph: number, weatherCode: number): 'STABLE' | 'MODERATE_RISK' | 'HIGH_RISK' {
    if (rainProbabilityPct >= 70 || windKph >= 35 || [95, 96, 99].includes(weatherCode)) {
      return 'HIGH_RISK';
    }

    if (rainProbabilityPct >= 40 || windKph >= 25 || [80, 81, 82].includes(weatherCode)) {
      return 'MODERATE_RISK';
    }

    return 'STABLE';
  }

  private buildAdvisory(riskLevel: 'STABLE' | 'MODERATE_RISK' | 'HIGH_RISK') {
    if (riskLevel === 'HIGH_RISK') {
      return 'Delay non-essential spraying, secure field equipment, and prioritize flood/wind-sensitive blocks.';
    }

    if (riskLevel === 'MODERATE_RISK') {
      return 'Keep irrigation and disease-prone areas under watch, and verify critical field tasks before noon.';
    }

    return 'Proceed with normal operations while maintaining routine weather checks for schedule optimization.';
  }

  private selectDominantWeatherCode(codes: number[]) {
    if (!codes.length) return 0;
    if (codes.some((code) => [95, 96, 99].includes(code))) return 95;
    if (codes.some((code) => [80, 81, 82].includes(code))) return 80;
    if (codes.some((code) => [61, 63, 65, 66, 67].includes(code))) return 61;
    if (codes.some((code) => [51, 53, 55, 56, 57].includes(code))) return 51;
    if (codes.some((code) => [45, 48].includes(code))) return 45;
    return codes[0] ?? 0;
  }

  private parseCoordinatesFromText(locationText: string) {
    const text = locationText.trim();
    if (!text) return null;

    // Accept common coordinate formats like "5.6037,-0.1870" or "5.6037, -0.1870".
    const coordinatePattern = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
    const match = coordinatePattern.exec(text);
    if (!match) return null;

    const latitude = this.normalizeNumeric(match[1]);
    const longitude = this.normalizeNumeric(match[2]);

    if (latitude === null || longitude === null) return null;

    return {
      label: `Profile Coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      latitude: this.clamp(latitude, -90, 90),
      longitude: this.clamp(longitude, -180, 180),
      timezone: 'auto',
    };
  }

  private fallbackSyntheticWeather(unresolvedAlerts: Array<{ level: string }>): WeatherForecastPayload {
    const weatherRiskScore = this.clamp(
      unresolvedAlerts.filter((alert) => alert.level === 'CRITICAL').length * 15
      + unresolvedAlerts.filter((alert) => alert.level === 'WARNING').length * 6,
      8,
      95,
    );
    const weatherCondition: 'STABLE' | 'MODERATE_RISK' | 'HIGH_RISK' = weatherRiskScore > 70
      ? 'HIGH_RISK'
      : weatherRiskScore > 45
        ? 'MODERATE_RISK'
        : 'STABLE';

    const todayRain = this.clamp(Math.round(weatherRiskScore * 0.9), 5, 98);
    const todayMinTemp = this.clamp(14 + Math.round(weatherRiskScore * 0.06), 10, 26);
    const todayMaxTemp = this.clamp(26 + Math.round(weatherRiskScore * 0.07), 23, 42);
    const todayWind = this.clamp(8 + Math.round(weatherRiskScore * 0.22), 6, 34);

    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + index);

      const rain = this.clamp(todayRain + ((index % 3) - 1) * 7, 2, 98);
      const wind = this.clamp(todayWind + ((index % 2) * 3) - 1, 4, 40);
      const tempMin = this.clamp(todayMinTemp + ((index % 4) - 1), 8, 30);
      const tempMax = this.clamp(todayMaxTemp + ((index % 5) - 2), 18, 44);
      const riskLevel = this.riskFromWeather(rain, wind, rain > 65 ? 61 : 1);

      return {
        date: date.toISOString().slice(0, 10),
        summary: rain > 60 ? 'Rain' : rain > 35 ? 'Cloudy' : 'Clear',
        riskLevel,
        rainProbabilityPct: rain,
        windKph: wind,
        temperatureMinC: tempMin,
        temperatureMaxC: tempMax,
      };
    });

    return {
      source: 'SYNTHETIC',
      location: null,
      riskLevel: weatherCondition,
      next24hRainProbabilityPct: todayRain,
      next24hRainMm: Number((todayRain * 0.07).toFixed(1)),
      next24hTemperatureRangeC: {
        min: todayMinTemp,
        max: todayMaxTemp,
      },
      windKph: todayWind,
      advisory: this.buildAdvisory(weatherCondition),
      daily,
    };
  }

  private async resolveFarmLocation(farmId: string): Promise<ResolvedFarmLocation | null> {
    const cached = this.locationCache.get(farmId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const [farm, latestProfileEvent, latestReading] = await Promise.all([
      prisma.farm.findUnique({ where: { id: farmId }, select: { name: true } }),
      prisma.event.findFirst({
        where: { farmId, type: 'FARM_PROFILE_UPDATED' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sensorReading.findFirst({
        where: { device: { farmId } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const readingPayload = (latestReading?.data ?? null) as Record<string, unknown> | null;
    const fromSensorLat = this.pickNumeric(readingPayload, ['latitude', 'lat', 'gpsLat']);
    const fromSensorLon = this.pickNumeric(readingPayload, ['longitude', 'lng', 'lon', 'gpsLon']);

    if (fromSensorLat !== null && fromSensorLon !== null) {
      const sensorLocation = {
        label: 'Sensor GPS',
        latitude: this.clamp(fromSensorLat, -90, 90),
        longitude: this.clamp(fromSensorLon, -180, 180),
        timezone: 'auto',
      };
      this.locationCache.set(farmId, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, value: sensorLocation });
      return sensorLocation;
    }

    const profilePayload = (latestProfileEvent?.payload ?? null) as Record<string, unknown> | null;
    const profileLocation = typeof profilePayload?.location === 'string' ? profilePayload.location.trim() : '';

    if (profileLocation) {
      const profileCoordinates = this.parseCoordinatesFromText(profileLocation);
      if (profileCoordinates) {
        this.locationCache.set(farmId, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, value: profileCoordinates });
        return profileCoordinates;
      }
    }

    const locationQuery = [
      profileLocation,
      farm?.name?.trim() ?? '',
    ].find((value) => value.length > 0);

    if (!locationQuery) {
      this.locationCache.set(farmId, { expiresAt: Date.now() + 60 * 60 * 1000, value: null });
      return null;
    }

    try {
      const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery)}&count=1&language=en&format=json`;
      const geocodeResponse = await fetch(geocodeUrl, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });

      if (!geocodeResponse.ok) {
        this.locationCache.set(farmId, { expiresAt: Date.now() + 60 * 60 * 1000, value: null });
        return null;
      }

      const geocodeData = await geocodeResponse.json() as {
        results?: Array<{
          name?: string;
          country?: string;
          latitude?: number;
          longitude?: number;
          timezone?: string;
        }>;
      };

      const first = geocodeData.results?.[0];
      if (!first || typeof first.latitude !== 'number' || typeof first.longitude !== 'number') {
        this.locationCache.set(farmId, { expiresAt: Date.now() + 60 * 60 * 1000, value: null });
        return null;
      }

      const resolved = {
        label: [first.name, first.country].filter(Boolean).join(', ') || locationQuery,
        latitude: first.latitude,
        longitude: first.longitude,
        timezone: first.timezone || 'auto',
      };

      this.locationCache.set(farmId, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, value: resolved });
      return resolved;
    } catch {
      this.locationCache.set(farmId, { expiresAt: Date.now() + 60 * 60 * 1000, value: null });
      return null;
    }
  }

  private async resolveWeatherForecast(farmId: string, unresolvedAlerts: Array<{ level: string }>): Promise<WeatherForecastPayload> {
    const cached = this.forecastCache.get(farmId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const location = await this.resolveFarmLocation(farmId);
    if (!location) {
      const fallback = this.fallbackSyntheticWeather(unresolvedAlerts);
      this.forecastCache.set(farmId, { expiresAt: Date.now() + 30 * 60 * 1000, value: fallback });
      return fallback;
    }

    try {
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&hourly=precipitation_probability,precipitation,weather_code,wind_speed_10m,temperature_2m&forecast_days=7&forecast_hours=24&timezone=${encodeURIComponent(location.timezone)}`;
      const forecastResponse = await fetch(forecastUrl, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });

      if (!forecastResponse.ok) {
        throw new Error('Weather provider unavailable');
      }

      const payload = await forecastResponse.json() as {
        daily?: {
          time?: string[];
          weather_code?: number[];
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
          precipitation_probability_max?: number[];
          wind_speed_10m_max?: number[];
        };
        hourly?: {
          time?: string[];
          precipitation_probability?: number[];
          precipitation?: number[];
          weather_code?: number[];
          wind_speed_10m?: number[];
          temperature_2m?: number[];
        };
      };

      const dailyTime = payload.daily?.time ?? [];
      const dailyCodes = payload.daily?.weather_code ?? [];
      const dailyMaxTemp = payload.daily?.temperature_2m_max ?? [];
      const dailyMinTemp = payload.daily?.temperature_2m_min ?? [];
      const dailyRainProbability = payload.daily?.precipitation_probability_max ?? [];
      const dailyWind = payload.daily?.wind_speed_10m_max ?? [];
      const hourlyRainProbability = payload.hourly?.precipitation_probability ?? [];
      const hourlyRainAmount = payload.hourly?.precipitation ?? [];
      const hourlyWeatherCode = payload.hourly?.weather_code ?? [];
      const hourlyWind = payload.hourly?.wind_speed_10m ?? [];
      const hourlyTemperature = payload.hourly?.temperature_2m ?? [];

      if (!dailyTime.length) {
        throw new Error('Weather provider returned empty forecast');
      }

      const daily: DailyWeatherForecast[] = dailyTime.map((date, index) => {
        const code = Math.round(Number(dailyCodes[index] ?? 1));
        const rainProbabilityPct = this.clamp(Math.round(Number(dailyRainProbability[index] ?? 0)), 0, 100);
        const windKph = this.clamp(Math.round(Number(dailyWind[index] ?? 0)), 0, 120);
        const temperatureMaxC = Number(this.clamp(Number(dailyMaxTemp[index] ?? 28), -30, 55).toFixed(1));
        const temperatureMinC = Number(this.clamp(Number(dailyMinTemp[index] ?? 18), -40, 45).toFixed(1));
        const riskLevel = this.riskFromWeather(rainProbabilityPct, windKph, code);

        return {
          date,
          summary: this.weatherCodeSummary(code),
          riskLevel,
          rainProbabilityPct,
          windKph,
          temperatureMinC,
          temperatureMaxC,
        };
      });

      const next24hRainProbabilityPct = this.clamp(
        Math.round(Math.max(...hourlyRainProbability.map((value) => Number(value) || 0), daily[0]?.rainProbabilityPct ?? 0)),
        0,
        100,
      );
      const next24hRainMm = Number(
        this.clamp(
          hourlyRainAmount.reduce((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0),
          0,
          500,
        ).toFixed(1),
      );
      const next24hWindKph = this.clamp(
        Math.round(Math.max(...hourlyWind.map((value) => Number(value) || 0), daily[0]?.windKph ?? 0)),
        0,
        120,
      );
      const next24hMinTempC = Number(
        this.clamp(
          Math.min(...hourlyTemperature.map((value) => Number(value) || Infinity), daily[0]?.temperatureMinC ?? 0),
          -40,
          45,
        ).toFixed(1),
      );
      const next24hMaxTempC = Number(
        this.clamp(
          Math.max(...hourlyTemperature.map((value) => Number(value) || -Infinity), daily[0]?.temperatureMaxC ?? 0),
          -30,
          55,
        ).toFixed(1),
      );
      const dominantCode = this.selectDominantWeatherCode(hourlyWeatherCode.map((value) => Math.round(Number(value) || 0)));
      const next24hRiskLevel = this.riskFromWeather(next24hRainProbabilityPct, next24hWindKph, dominantCode);

      const resolved: WeatherForecastPayload = {
        source: 'OPEN_METEO',
        location,
        riskLevel: next24hRiskLevel,
        next24hRainProbabilityPct,
        next24hRainMm,
        next24hTemperatureRangeC: {
          min: next24hMinTempC,
          max: next24hMaxTempC,
        },
        windKph: next24hWindKph,
        advisory: this.buildAdvisory(next24hRiskLevel),
        daily,
      };

      this.forecastCache.set(farmId, { expiresAt: Date.now() + 60 * 60 * 1000, value: resolved });
      return resolved;
    } catch {
      const fallback = this.fallbackSyntheticWeather(unresolvedAlerts);
      this.forecastCache.set(farmId, { expiresAt: Date.now() + 30 * 60 * 1000, value: fallback });
      return fallback;
    }
  }

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

    const weatherForecast = await this.resolveWeatherForecast(farmId, unresolvedAlerts);

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
