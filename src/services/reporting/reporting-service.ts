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

type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type TransactionRecord = {
  requestId: string;
  requestedAt: string;
  amount: number;
  category: string;
  description: string;
  status: TransactionStatus;
  decidedAt: string | null;
  decidedBy: string | null;
  decision: TransactionStatus | null;
  comment: string | null;
};

type TransactionReport = {
  generatedAt: string;
  periodDays: number;
  totals: {
    totalTransactions: number;
    pendingTransactions: number;
    approvedTransactions: number;
    rejectedTransactions: number;
    totalAmount: number;
    approvedAmount: number;
    rejectedAmount: number;
  };
  records: TransactionRecord[];
};

type DomainRecentRecord = {
  id: string;
  when: string;
  action: string;
  note: string;
};

type OperationsDetailReport = {
  generatedAt: string;
  periodDays: number;
  market: {
    activeListings: number;
    totalListings: number;
    openInterests: number;
    recent: DomainRecentRecord[];
  };
  updates: {
    totalUpdates: number;
    recent: DomainRecentRecord[];
  };
  digest: {
    snapshots: number;
    recent: DomainRecentRecord[];
  };
  procurement: {
    purchaseOrders: number;
    issuedOrDelivered: number;
    recent: DomainRecentRecord[];
  };
  payroll: {
    runs: number;
    paidRuns: number;
    totalNetPay: number;
    recent: DomainRecentRecord[];
  };
  monitoring: {
    alerts: number;
    unresolvedAlerts: number;
    devices: number;
    recent: DomainRecentRecord[];
  };
  incident: {
    reported: number;
    resolved: number;
    openSignals: number;
    recent: DomainRecentRecord[];
  };
  message: {
    totalMessages: number;
    withAttachments: number;
    recent: DomainRecentRecord[];
  };
  consultation: {
    requested: number;
    inProgress: number;
    resolved: number;
    recent: DomainRecentRecord[];
  };
  vendor: {
    vendors: number;
    confirmedOrders: number;
    recent: DomainRecentRecord[];
  };
  farmhands: {
    workers: number;
    events: number;
    recent: DomainRecentRecord[];
  };
  audit: {
    audits: number;
    auditResults: number;
    recent: DomainRecentRecord[];
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toRecentEventRecord(event: { id: string; createdAt: Date; type: string; payload: unknown }, note: string): DomainRecentRecord {
  return {
    id: event.id,
    when: event.createdAt.toISOString(),
    action: event.type,
    note,
  };
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

  async buildTransactionReport(farmId: string, periodDays = 30): Promise<TransactionReport> {
    const windowStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [requests, decisionEvents] = await Promise.all([
      prisma.spendRequest.findMany({
        where: {
          farmId,
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.event.findMany({
        where: {
          farmId,
          type: 'SPEND_REQUEST_DECIDED',
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const decisionByRequestId = new Map<string, {
      decidedAt: string;
      decidedBy: string | null;
      decision: TransactionStatus | null;
      comment: string | null;
    }>();

    for (const event of decisionEvents) {
      const payload = asRecord(event.payload);
      const requestId = typeof payload?.requestId === 'string' ? payload.requestId : null;
      if (!requestId || decisionByRequestId.has(requestId)) {
        continue;
      }

      const decisionRaw = typeof payload?.decision === 'string' ? payload.decision : null;
      const decision = decisionRaw === 'APPROVED' || decisionRaw === 'REJECTED' || decisionRaw === 'PENDING'
        ? decisionRaw
        : null;
      const comment = typeof payload?.comment === 'string' ? payload.comment : null;

      decisionByRequestId.set(requestId, {
        decidedAt: event.createdAt.toISOString(),
        decidedBy: event.userId ?? null,
        decision,
        comment,
      });
    }

    const records: TransactionRecord[] = requests.map((request) => {
      const decisionContext = decisionByRequestId.get(request.id);
      const status = (request.status === 'APPROVED' || request.status === 'REJECTED' || request.status === 'PENDING')
        ? request.status
        : 'PENDING';

      return {
        requestId: request.id,
        requestedAt: request.createdAt.toISOString(),
        amount: Number(request.amount),
        category: request.category,
        description: request.description,
        status,
        decidedAt: decisionContext?.decidedAt ?? null,
        decidedBy: decisionContext?.decidedBy ?? null,
        decision: decisionContext?.decision ?? null,
        comment: decisionContext?.comment ?? null,
      };
    });

    const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);
    const approvedAmount = records
      .filter((record) => record.status === 'APPROVED')
      .reduce((sum, record) => sum + record.amount, 0);
    const rejectedAmount = records
      .filter((record) => record.status === 'REJECTED')
      .reduce((sum, record) => sum + record.amount, 0);

    return {
      generatedAt: new Date().toISOString(),
      periodDays,
      totals: {
        totalTransactions: records.length,
        pendingTransactions: records.filter((record) => record.status === 'PENDING').length,
        approvedTransactions: records.filter((record) => record.status === 'APPROVED').length,
        rejectedTransactions: records.filter((record) => record.status === 'REJECTED').length,
        totalAmount: Number(totalAmount.toFixed(2)),
        approvedAmount: Number(approvedAmount.toFixed(2)),
        rejectedAmount: Number(rejectedAmount.toFixed(2)),
      },
      records,
    };
  }

  async buildOperationsDetailReport(farmId: string, periodDays = 30): Promise<OperationsDetailReport> {
    const windowStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [
      marketEvents,
      dailyUpdates,
      digestSnapshots,
      purchaseOrders,
      payrollRuns,
      alerts,
      deviceCount,
      incidentEvents,
      issues,
      messages,
      consultationEvents,
      vendorCount,
      vendorEvents,
      farmhandsEvents,
      workerCount,
      audits,
      auditResults,
    ] = await Promise.all([
      prisma.event.findMany({
        where: {
          farmId,
          createdAt: { gte: windowStart },
          type: {
            in: [
              'MARKETPLACE_LISTING_CREATED',
              'MARKETPLACE_LISTING_CLOSED',
              'MARKETPLACE_INTEREST_SUBMITTED',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 600,
      }),
      prisma.dailyUpdate.findMany({
        where: { farmId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.weeklyDigestSnapshot.findMany({
        where: { farmId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.purchaseOrder.findMany({
        where: { farmId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.payrollRun.findMany({
        where: { farmId, endDate: { gte: windowStart } },
        include: { entries: true },
        orderBy: { endDate: 'desc' },
        take: 100,
      }),
      prisma.alert.findMany({
        where: { farmId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.sensorDevice.count({ where: { farmId } }),
      prisma.event.findMany({
        where: {
          farmId,
          createdAt: { gte: windowStart },
          type: { in: ['ISSUE_REPORTED', 'EXPERT_REQUESTED', 'ISSUE_RESOLVED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.issue.findMany({
        where: { farmId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.event.findMany({
        where: { farmId, createdAt: { gte: windowStart }, type: 'MESSAGE_SENT' },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      prisma.event.findMany({
        where: {
          farmId,
          createdAt: { gte: windowStart },
          type: {
            in: [
              'CONSULTATION_REQUESTED',
              'CONSULTATION_MESSAGE',
              'CONSULTATION_STATUS_UPDATED',
              'CONSULTATION_ASSIGNED',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 400,
      }),
      prisma.vendor.count({ where: { farmId } }),
      prisma.event.findMany({
        where: { farmId, createdAt: { gte: windowStart }, type: 'VENDOR_PO_CONFIRMED' },
        orderBy: { createdAt: 'desc' },
        take: 120,
      }),
      prisma.event.findMany({
        where: { farmId, createdAt: { gte: windowStart }, type: { startsWith: 'FARMHANDS_' } },
        orderBy: { createdAt: 'desc' },
        take: 400,
      }),
      prisma.farmMembership.count({ where: { farmId, role: 'WORKER' } }),
      prisma.audit.findMany({
        where: { farmId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take: 120,
      }),
      prisma.auditResult.findMany({
        where: { farmId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'desc' },
        take: 120,
      }),
    ]);

    const listingCreated = marketEvents.filter((entry) => entry.type === 'MARKETPLACE_LISTING_CREATED');
    const listingClosed = new Set(
      marketEvents
        .filter((entry) => entry.type === 'MARKETPLACE_LISTING_CLOSED')
        .map((entry) => {
          const payload = asRecord(entry.payload);
          return typeof payload?.listingId === 'string' ? payload.listingId : null;
        })
        .filter((entry): entry is string => Boolean(entry)),
    );
    const activeListings = listingCreated.filter((entry) => {
      const payload = asRecord(entry.payload);
      const listingId = typeof payload?.listingId === 'string' ? payload.listingId : '';
      return listingId.length > 0 && !listingClosed.has(listingId);
    }).length;

    const marketRecent = marketEvents.slice(0, 5).map((event) => {
      const payload = asRecord(event.payload);
      const title = typeof payload?.title === 'string' ? payload.title : 'Marketplace activity';
      const listingId = typeof payload?.listingId === 'string' ? payload.listingId.slice(0, 8) : 'n/a';
      return toRecentEventRecord(event, `${title} (${listingId})`);
    });

    const updatesRecent: DomainRecentRecord[] = dailyUpdates.slice(0, 5).map((update) => ({
      id: update.id,
      when: update.createdAt.toISOString(),
      action: 'DAILY_UPDATE_SUBMITTED',
      note: update.summary.slice(0, 90),
    }));

    const digestRecent: DomainRecentRecord[] = digestSnapshots.slice(0, 5).map((snapshot) => ({
      id: snapshot.id,
      when: snapshot.createdAt.toISOString(),
      action: 'WEEKLY_DIGEST_SNAPSHOT',
      note: `${snapshot.weekStart.toISOString().slice(0, 10)} to ${snapshot.weekEnd.toISOString().slice(0, 10)}`,
    }));

    const procurementRecent: DomainRecentRecord[] = purchaseOrders.slice(0, 5).map((order) => ({
      id: order.id,
      when: order.createdAt.toISOString(),
      action: 'PURCHASE_ORDER',
      note: `${order.status}`,
    }));

    const totalNetPay = payrollRuns.reduce((sum, run) => (
      sum + run.entries.reduce((entrySum, entry) => entrySum + Number(entry.netAmount), 0)
    ), 0);

    const payrollRecent: DomainRecentRecord[] = payrollRuns.slice(0, 5).map((run) => ({
      id: run.id,
      when: run.endDate.toISOString(),
      action: 'PAYROLL_RUN',
      note: `${run.status} (${run.entries.length} entries)`,
    }));

    const monitoringRecent: DomainRecentRecord[] = alerts.slice(0, 5).map((alert) => ({
      id: alert.id,
      when: alert.createdAt.toISOString(),
      action: 'ALERT',
      note: `${alert.level}: ${alert.message}`,
    }));

    const incidentRecent = incidentEvents.slice(0, 5).map((event) => {
      const payload = asRecord(event.payload);
      const title = typeof payload?.title === 'string' ? payload.title : 'Incident event';
      return toRecentEventRecord(event, title);
    });

    const messageRecent = messages.slice(0, 5).map((event) => {
      const payload = asRecord(event.payload);
      const text = typeof payload?.text === 'string' ? payload.text : 'Message sent';
      return toRecentEventRecord(event, text.slice(0, 90));
    });

    const consultationRecent = consultationEvents.slice(0, 5).map((event) => {
      const payload = asRecord(event.payload);
      const topic = typeof payload?.topic === 'string'
        ? payload.topic
        : typeof payload?.status === 'string'
          ? `Status ${payload.status}`
          : 'Consultation activity';
      return toRecentEventRecord(event, topic);
    });

    const vendorRecent = vendorEvents.slice(0, 5).map((event) => {
      const payload = asRecord(event.payload);
      const invoice = typeof payload?.invoiceNumber === 'string' ? payload.invoiceNumber : 'n/a';
      return toRecentEventRecord(event, `Invoice ${invoice}`);
    });

    const farmhandsRecent = farmhandsEvents.slice(0, 5).map((event) => {
      const payload = asRecord(event.payload);
      const requestId = typeof payload?.requestId === 'string' ? payload.requestId.slice(0, 8) : 'n/a';
      return toRecentEventRecord(event, `Request ${requestId}`);
    });

    const auditRecent: DomainRecentRecord[] = audits.slice(0, 5).map((audit) => ({
      id: audit.id,
      when: audit.createdAt.toISOString(),
      action: 'AUDIT',
      note: `Template ${audit.templateId}`,
    }));

    const withAttachments = messages.filter((event) => {
      const payload = asRecord(event.payload);
      return Array.isArray(payload?.attachments) && payload.attachments.length > 0;
    }).length;

    const consultationRequested = consultationEvents.filter((event) => event.type === 'CONSULTATION_REQUESTED').length;
    const consultationResolved = consultationEvents.filter((event) => {
      if (event.type !== 'CONSULTATION_STATUS_UPDATED') return false;
      const payload = asRecord(event.payload);
      return payload?.status === 'RESOLVED';
    }).length;
    const consultationInProgress = consultationEvents.filter((event) => {
      if (event.type !== 'CONSULTATION_STATUS_UPDATED') return false;
      const payload = asRecord(event.payload);
      return payload?.status === 'IN_PROGRESS';
    }).length;

    return {
      generatedAt: new Date().toISOString(),
      periodDays,
      market: {
        activeListings,
        totalListings: listingCreated.length,
        openInterests: marketEvents.filter((entry) => entry.type === 'MARKETPLACE_INTEREST_SUBMITTED').length,
        recent: marketRecent,
      },
      updates: {
        totalUpdates: dailyUpdates.length,
        recent: updatesRecent,
      },
      digest: {
        snapshots: digestSnapshots.length,
        recent: digestRecent,
      },
      procurement: {
        purchaseOrders: purchaseOrders.length,
        issuedOrDelivered: purchaseOrders.filter((order) => order.status === 'ISSUED' || order.status === 'DELIVERED').length,
        recent: procurementRecent,
      },
      payroll: {
        runs: payrollRuns.length,
        paidRuns: payrollRuns.filter((run) => run.status === 'PAID').length,
        totalNetPay: Number(totalNetPay.toFixed(2)),
        recent: payrollRecent,
      },
      monitoring: {
        alerts: alerts.length,
        unresolvedAlerts: alerts.filter((alert) => !alert.resolved).length,
        devices: deviceCount,
        recent: monitoringRecent,
      },
      incident: {
        reported: incidentEvents.filter((event) => event.type === 'ISSUE_REPORTED').length + issues.length,
        resolved: incidentEvents.filter((event) => event.type === 'ISSUE_RESOLVED').length + issues.filter((issue) => issue.status === 'RESOLVED').length,
        openSignals: issues.filter((issue) => issue.status !== 'RESOLVED').length,
        recent: incidentRecent,
      },
      message: {
        totalMessages: messages.length,
        withAttachments,
        recent: messageRecent,
      },
      consultation: {
        requested: consultationRequested,
        inProgress: consultationInProgress,
        resolved: consultationResolved,
        recent: consultationRecent,
      },
      vendor: {
        vendors: vendorCount,
        confirmedOrders: vendorEvents.length,
        recent: vendorRecent,
      },
      farmhands: {
        workers: workerCount,
        events: farmhandsEvents.length,
        recent: farmhandsRecent,
      },
      audit: {
        audits: audits.length,
        auditResults: auditResults.length,
        recent: auditRecent,
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

  toTransactionCsv(report: TransactionReport) {
    const header = 'requestId,requestedAt,amount,category,description,status,decidedAt,decidedBy,decision,comment';
    const rows = report.records.map((record) => [
      escapeCsv(record.requestId),
      escapeCsv(record.requestedAt),
      escapeCsv(record.amount),
      escapeCsv(record.category),
      escapeCsv(record.description),
      escapeCsv(record.status),
      escapeCsv(record.decidedAt ?? ''),
      escapeCsv(record.decidedBy ?? ''),
      escapeCsv(record.decision ?? ''),
      escapeCsv(record.comment ?? ''),
    ].join(','));

    return [header, ...rows].join('\n');
  }

  toTransactionExcelTsv(report: TransactionReport) {
    const rows = [
      ['Request ID', 'Requested At', 'Amount', 'Category', 'Description', 'Status', 'Decided At', 'Decided By', 'Decision', 'Comment'],
      ...report.records.map((record) => [
        record.requestId,
        record.requestedAt,
        record.amount,
        record.category,
        record.description,
        record.status,
        record.decidedAt ?? '',
        record.decidedBy ?? '',
        record.decision ?? '',
        record.comment ?? '',
      ]),
    ];

    return rows.map((row) => row.join('\t')).join('\n');
  }

  toTransactionPdf(report: TransactionReport) {
    const recordsPreview = report.records.slice(0, 20);
    const lines = [
      'Farm Transaction Report',
      `Generated: ${report.generatedAt}`,
      `Period (days): ${report.periodDays}`,
      `Total transactions: ${report.totals.totalTransactions}`,
      `Approved amount: ${report.totals.approvedAmount}`,
      `Rejected amount: ${report.totals.rejectedAmount}`,
      '',
      'Recent Records (up to 20)',
      ...recordsPreview.map((record) => `${record.requestId.slice(0, 8)} | ${record.status} | ${record.category} | ${record.amount}`),
    ];

    return buildSimplePdf(lines);
  }
}

export const reportingService = new ReportingService();
