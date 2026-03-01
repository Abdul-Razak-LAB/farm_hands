import { prisma } from '@/lib/prisma';

type ReportSummary = {
  generatedAt: string;
  periodDays: number;
  cropHealthAndYield: {
    averageMoisture: number;
    averageTemperature: number;
    estimatedYieldScore: number;
  };
  waterAndEnergyUsage: {
    waterLiters: number;
    energyKwh: number;
  };
  equipmentMaintenanceAndPerformance: {
    totalDevices: number;
    unresolvedAlerts: number;
    criticalAlerts: number;
  };
  laborCostAndProductivity: {
    totalLaborCost: number;
    payrollEntries: number;
    completedTasks: number;
  };
};

function parseNumericFromReading(data: unknown, keys: string[]) {
  if (!data || typeof data !== 'object') return null;
  const source = data as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function escapeCsv(value: string | number) {
  const stringValue = String(value ?? '');
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function buildSimplePdf(lines: string[]) {
  const escapedLines = lines.map((line) => line
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)'));

  const contentStream = [
    'BT',
    '/F1 11 Tf',
    '40 760 Td',
    ...escapedLines.map((line, index) => `${index === 0 ? '' : '0 -16 Td'} (${line}) Tj`).filter(Boolean),
    'ET',
  ].join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
  objects.push('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj');
  objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
  objects.push(`5 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`);

  let output = '%PDF-1.4\n';
  const xrefPositions = [0];
  for (const object of objects) {
    xrefPositions.push(output.length);
    output += `${object}\n`;
  }

  const xrefStart = output.length;
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let i = 1; i < xrefPositions.length; i += 1) {
    output += `${String(xrefPositions[i]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(output, 'binary');
}

export class ReportingService {
  async buildSummary(farmId: string, periodDays = 30): Promise<ReportSummary> {
    const windowStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [readings, alerts, payrollEntries, tasks] = await Promise.all([
      prisma.sensorReading.findMany({
        where: {
          device: { farmId },
          createdAt: { gte: windowStart },
        },
      }),
      prisma.alert.findMany({
        where: {
          farmId,
          createdAt: { gte: windowStart },
        },
      }),
      prisma.payrollEntry.findMany({
        where: {
          payrollRun: {
            farmId,
            endDate: { gte: windowStart },
          },
        },
      }),
      prisma.task.findMany({
        where: {
          farmId,
          updatedAt: { gte: windowStart },
        },
      }),
    ]);

    const moistureValues = readings
      .map((reading) => parseNumericFromReading(reading.data, ['soilMoisture', 'moisture', 'moisturePct']))
      .filter((value): value is number => value !== null);

    const temperatureValues = readings
      .map((reading) => parseNumericFromReading(reading.data, ['temperature', 'temperatureC', 'temp']))
      .filter((value): value is number => value !== null);

    const waterValues = readings
      .map((reading) => parseNumericFromReading(reading.data, ['waterLiters', 'waterUsageLiters']))
      .filter((value): value is number => value !== null);

    const energyValues = readings
      .map((reading) => parseNumericFromReading(reading.data, ['energyKwh', 'energyUsageKwh']))
      .filter((value): value is number => value !== null);

    const completedTasks = tasks.filter((task) => task.status === 'COMPLETED' || task.status === 'VERIFIED').length;
    const totalLaborCost = payrollEntries.reduce((sum, entry) => sum + Number(entry.netAmount), 0);
    const avgMoisture = moistureValues.length
      ? moistureValues.reduce((sum, value) => sum + value, 0) / moistureValues.length
      : 0;
    const avgTemp = temperatureValues.length
      ? temperatureValues.reduce((sum, value) => sum + value, 0) / temperatureValues.length
      : 0;

    return {
      generatedAt: new Date().toISOString(),
      periodDays,
      cropHealthAndYield: {
        averageMoisture: Number(avgMoisture.toFixed(2)),
        averageTemperature: Number(avgTemp.toFixed(2)),
        estimatedYieldScore: Number((Math.max(0, Math.min(100, 45 + avgMoisture * 0.5 + completedTasks * 0.4))).toFixed(2)),
      },
      waterAndEnergyUsage: {
        waterLiters: Number(waterValues.reduce((sum, value) => sum + value, 0).toFixed(2)),
        energyKwh: Number(energyValues.reduce((sum, value) => sum + value, 0).toFixed(2)),
      },
      equipmentMaintenanceAndPerformance: {
        totalDevices: new Set(readings.map((reading) => reading.deviceId)).size,
        unresolvedAlerts: alerts.filter((alert) => !alert.resolved).length,
        criticalAlerts: alerts.filter((alert) => alert.level === 'CRITICAL').length,
      },
      laborCostAndProductivity: {
        totalLaborCost: Number(totalLaborCost.toFixed(2)),
        payrollEntries: payrollEntries.length,
        completedTasks,
      },
    };
  }

  toCsv(summary: ReportSummary) {
    const rows: Array<[string, string | number]> = [
      ['generatedAt', summary.generatedAt],
      ['periodDays', summary.periodDays],
      ['crop.averageMoisture', summary.cropHealthAndYield.averageMoisture],
      ['crop.averageTemperature', summary.cropHealthAndYield.averageTemperature],
      ['crop.estimatedYieldScore', summary.cropHealthAndYield.estimatedYieldScore],
      ['resource.waterLiters', summary.waterAndEnergyUsage.waterLiters],
      ['resource.energyKwh', summary.waterAndEnergyUsage.energyKwh],
      ['equipment.totalDevices', summary.equipmentMaintenanceAndPerformance.totalDevices],
      ['equipment.unresolvedAlerts', summary.equipmentMaintenanceAndPerformance.unresolvedAlerts],
      ['equipment.criticalAlerts', summary.equipmentMaintenanceAndPerformance.criticalAlerts],
      ['labor.totalLaborCost', summary.laborCostAndProductivity.totalLaborCost],
      ['labor.payrollEntries', summary.laborCostAndProductivity.payrollEntries],
      ['labor.completedTasks', summary.laborCostAndProductivity.completedTasks],
    ];

    return ['metric,value', ...rows.map(([metric, value]) => `${escapeCsv(metric)},${escapeCsv(value)}`)].join('\n');
  }

  toExcelTsv(summary: ReportSummary) {
    const rows = [
      ['Metric', 'Value'],
      ['Generated At', summary.generatedAt],
      ['Period (Days)', summary.periodDays],
      ['Avg Soil Moisture', summary.cropHealthAndYield.averageMoisture],
      ['Avg Temperature', summary.cropHealthAndYield.averageTemperature],
      ['Estimated Yield Score', summary.cropHealthAndYield.estimatedYieldScore],
      ['Water Usage (L)', summary.waterAndEnergyUsage.waterLiters],
      ['Energy Usage (kWh)', summary.waterAndEnergyUsage.energyKwh],
      ['Total Devices', summary.equipmentMaintenanceAndPerformance.totalDevices],
      ['Unresolved Alerts', summary.equipmentMaintenanceAndPerformance.unresolvedAlerts],
      ['Critical Alerts', summary.equipmentMaintenanceAndPerformance.criticalAlerts],
      ['Labor Cost', summary.laborCostAndProductivity.totalLaborCost],
      ['Payroll Entries', summary.laborCostAndProductivity.payrollEntries],
      ['Completed Tasks', summary.laborCostAndProductivity.completedTasks],
    ];

    return rows.map((row) => row.join('\t')).join('\n');
  }

  toPdf(summary: ReportSummary) {
    const lines = [
      'Farm Performance Report',
      `Generated: ${summary.generatedAt}`,
      `Period (days): ${summary.periodDays}`,
      '',
      `Avg Soil Moisture: ${summary.cropHealthAndYield.averageMoisture}`,
      `Avg Temperature: ${summary.cropHealthAndYield.averageTemperature}`,
      `Yield Score: ${summary.cropHealthAndYield.estimatedYieldScore}`,
      `Water Usage (L): ${summary.waterAndEnergyUsage.waterLiters}`,
      `Energy Usage (kWh): ${summary.waterAndEnergyUsage.energyKwh}`,
      `Total Devices: ${summary.equipmentMaintenanceAndPerformance.totalDevices}`,
      `Unresolved Alerts: ${summary.equipmentMaintenanceAndPerformance.unresolvedAlerts}`,
      `Critical Alerts: ${summary.equipmentMaintenanceAndPerformance.criticalAlerts}`,
      `Labor Cost: ${summary.laborCostAndProductivity.totalLaborCost}`,
      `Payroll Entries: ${summary.laborCostAndProductivity.payrollEntries}`,
      `Completed Tasks: ${summary.laborCostAndProductivity.completedTasks}`,
    ];

    return buildSimplePdf(lines);
  }
}

export const reportingService = new ReportingService();
