import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { runSerializableTransactionWithRetry } from '@/lib/transaction-retry';
import { alertPreferencesService } from '@/services/monitoring/alert-preferences-service';

type ContractServiceType =
  | 'LABOR_SUPPLY'
  | 'FARM_MANAGER'
  | 'INPUT_SUPPLY'
  | 'FIELD_OPERATIONS'
  | 'MECHANIZATION'
  | 'CROP_PROTECTION';

type ServiceRequestType =
  | 'LABOR'
  | 'WORKER_REPLACEMENT'
  | 'FARM_MANAGER_SUPPORT'
  | 'INPUT_DELIVERY'
  | 'SPRAYING'
  | 'HARVEST_SUPPORT';

type InputCatalogItem = {
  sku: string;
  name: string;
  category: 'FERTILIZER' | 'WEEDICIDE' | 'HERBICIDE' | 'INSECTICIDE' | 'TOOLS' | 'PPE' | 'SEED' | 'OTHER';
  unit: string;
  defaultUnitPrice: number;
};

type ServiceRequestStatus = 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';

type SlaEscalationRule = {
  ruleId: string;
  name: string;
  isActive: boolean;
  maxAssignmentMinutes: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  notifyOwner: boolean;
  notifyManager: boolean;
  createdAt: string;
};

export class FarmhandsService {
  private readonly fulfillmentVendorName = 'FarmHands Fulfillment';

  private readonly inputCatalog: InputCatalogItem[] = [
    { sku: 'FH-FERT-NPK-50', name: 'NPK Fertilizer 50kg', category: 'FERTILIZER', unit: 'bag', defaultUnitPrice: 42 },
    { sku: 'FH-FERT-UREA-50', name: 'Urea Fertilizer 50kg', category: 'FERTILIZER', unit: 'bag', defaultUnitPrice: 38 },
    { sku: 'FH-WEED-GLY-20L', name: 'Glyphosate Weedicide 20L', category: 'WEEDICIDE', unit: 'can', defaultUnitPrice: 64 },
    { sku: 'FH-HERB-PREMIX-10L', name: 'Pre-emergence Herbicide 10L', category: 'HERBICIDE', unit: 'can', defaultUnitPrice: 55 },
    { sku: 'FH-INS-ALPHA-1L', name: 'Insecticide Alpha 1L', category: 'INSECTICIDE', unit: 'bottle', defaultUnitPrice: 18 },
    { sku: 'FH-TOOL-CUTLASS', name: 'Cutlass', category: 'TOOLS', unit: 'piece', defaultUnitPrice: 9 },
    { sku: 'FH-PPE-BOOT', name: 'Farm Boots', category: 'PPE', unit: 'pair', defaultUnitPrice: 16 },
    { sku: 'FH-PPE-GLOVE', name: 'Protective Gloves', category: 'PPE', unit: 'pair', defaultUnitPrice: 4 },
  ];

  private readonly defaultSlaRules: SlaEscalationRule[] = [
    {
      ruleId: 'default-critical-assign',
      name: 'Critical requests must be assigned quickly',
      isActive: true,
      maxAssignmentMinutes: 120,
      severity: 'CRITICAL',
      notifyOwner: true,
      notifyManager: true,
      createdAt: new Date(0).toISOString(),
    },
    {
      ruleId: 'default-standard-assign',
      name: 'Standard requests should be assigned within SLA',
      isActive: true,
      maxAssignmentMinutes: 24 * 60,
      severity: 'WARNING',
      notifyOwner: true,
      notifyManager: true,
      createdAt: new Date(0).toISOString(),
    },
  ];

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

  private readString(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    return typeof value === 'string' ? value : null;
  }

  private readNumber(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private readIsoDate(payload: Record<string, unknown>, key: string) {
    const value = this.readString(payload, key);
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : value;
  }

  private prioritySlaHours(priority: string) {
    switch (priority) {
      case 'CRITICAL':
        return 2;
      case 'HIGH':
        return 8;
      case 'LOW':
        return 48;
      default:
        return 24;
    }
  }

  private async getContractMap(farmId: string) {
    const events = await prisma.event.findMany({
      where: {
        farmId,
        type: { in: ['FARMHANDS_CONTRACT_CREATED', 'FARMHANDS_CONTRACT_RENEWED'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    const map = new Map<string, any>();
    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;

      if (event.type === 'FARMHANDS_CONTRACT_CREATED') {
        const contractId = this.readString(payload, 'contractId') || event.id;
        map.set(contractId, {
          contractId,
          ownerName: this.readString(payload, 'ownerName') || '',
          packageName: this.readString(payload, 'packageName') || 'CUSTOM',
          serviceTypes: Array.isArray(payload.serviceTypes) ? payload.serviceTypes : [],
          farmSizeHectares: this.readNumber(payload, 'farmSizeHectares'),
          startDate: this.readIsoDate(payload, 'startDate'),
          endDate: this.readIsoDate(payload, 'endDate'),
          status: this.readString(payload, 'status') || 'ACTIVE',
          notes: this.readString(payload, 'notes') || '',
          renewalCount: 0,
          lastRenewedAt: null,
          createdAt: event.createdAt.toISOString(),
        });
        continue;
      }

      if (event.type === 'FARMHANDS_CONTRACT_RENEWED') {
        const contractId = this.readString(payload, 'contractId');
        if (!contractId || !map.has(contractId)) continue;
        const current = map.get(contractId);
        current.endDate = this.readIsoDate(payload, 'newEndDate') || current.endDate;
        current.status = this.readString(payload, 'status') || 'ACTIVE';
        current.renewalCount += 1;
        current.lastRenewedAt = event.createdAt.toISOString();
        if (this.readString(payload, 'renewalNotes')) {
          current.notes = `${current.notes ? `${current.notes} | ` : ''}Renewal: ${this.readString(payload, 'renewalNotes')}`;
        }
      }
    }

    return map;
  }

  private async getServiceRequestMap(farmId: string) {
    const events = await prisma.event.findMany({
      where: {
        farmId,
        type: {
          in: [
            'FARMHANDS_SERVICE_REQUESTED',
            'FARMHANDS_SERVICE_ASSIGNED',
            'FARMHANDS_SERVICE_STATUS_UPDATED',
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    const map = new Map<string, any>();

    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;

      if (event.type === 'FARMHANDS_SERVICE_REQUESTED') {
        const requestId = this.readString(payload, 'requestId') || event.id;
        const priority = this.readString(payload, 'priority') || 'NORMAL';
        const slaHours = this.prioritySlaHours(priority);
        map.set(requestId, {
          requestId,
          contractId: this.readString(payload, 'contractId'),
          type: this.readString(payload, 'type') || 'LABOR',
          priority,
          neededBy: this.readIsoDate(payload, 'neededBy'),
          headcount: this.readNumber(payload, 'headcount'),
          description: this.readString(payload, 'description') || '',
          status: (this.readString(payload, 'status') || 'PENDING_ASSIGNMENT') as ServiceRequestStatus,
          assignedToUserId: null,
          assignedToName: null,
          assignedAt: null,
          startedAt: null,
          completedAt: null,
          assignmentNotes: null,
          slaHours,
          slaTargetAt: new Date(event.createdAt.getTime() + slaHours * 60 * 60 * 1000).toISOString(),
          slaBreached: false,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.createdAt.toISOString(),
        });
        continue;
      }

      if (event.type === 'FARMHANDS_SERVICE_ASSIGNED') {
        const requestId = this.readString(payload, 'requestId');
        if (!requestId || !map.has(requestId)) continue;
        const item = map.get(requestId);
        item.assignedToUserId = this.readString(payload, 'assignedToUserId');
        item.assignedToName = this.readString(payload, 'assignedToName');
        item.assignmentNotes = this.readString(payload, 'notes');
        item.assignedAt = event.createdAt.toISOString();
        item.status = 'ASSIGNED';
        item.updatedAt = event.createdAt.toISOString();
        item.slaBreached = new Date(item.assignedAt).getTime() > new Date(item.slaTargetAt).getTime();
        continue;
      }

      if (event.type === 'FARMHANDS_SERVICE_STATUS_UPDATED') {
        const requestId = this.readString(payload, 'requestId');
        if (!requestId || !map.has(requestId)) continue;
        const item = map.get(requestId);
        const nextStatus = (this.readString(payload, 'status') || item.status) as ServiceRequestStatus;
        item.status = nextStatus;
        if (nextStatus === 'IN_PROGRESS' && !item.startedAt) {
          item.startedAt = event.createdAt.toISOString();
        }
        if (nextStatus === 'COMPLETED' && !item.completedAt) {
          item.completedAt = event.createdAt.toISOString();
        }
        item.updatedAt = event.createdAt.toISOString();
      }
    }

    return map;
  }

  private async getInvoiceMap(farmId: string) {
    const events = await prisma.event.findMany({
      where: {
        farmId,
        type: { in: ['FARMHANDS_INVOICE_CREATED', 'FARMHANDS_INVOICE_SETTLED'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    const map = new Map<string, any>();
    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;

      if (event.type === 'FARMHANDS_INVOICE_CREATED') {
        const invoiceId = this.readString(payload, 'invoiceId') || event.id;
        const amount = this.readNumber(payload, 'amount') || 0;
        const dueDate = this.readIsoDate(payload, 'dueDate');
        const isOverdue = dueDate ? new Date(dueDate).getTime() < Date.now() : false;
        map.set(invoiceId, {
          invoiceId,
          referenceType: this.readString(payload, 'referenceType') || 'CONTRACT',
          referenceId: this.readString(payload, 'referenceId') || '',
          amount,
          paidAmount: 0,
          currency: this.readString(payload, 'currency') || 'USD',
          dueDate,
          notes: this.readString(payload, 'notes') || '',
          status: (isOverdue ? 'OVERDUE' : 'ISSUED') as InvoiceStatus,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.createdAt.toISOString(),
        });
        continue;
      }

      if (event.type === 'FARMHANDS_INVOICE_SETTLED') {
        const invoiceId = this.readString(payload, 'invoiceId');
        if (!invoiceId || !map.has(invoiceId)) continue;
        const invoice = map.get(invoiceId);
        const paidAmount = this.readNumber(payload, 'paidAmount') || 0;
        invoice.paidAmount += paidAmount;
        invoice.status = invoice.paidAmount >= invoice.amount ? 'PAID' : 'PARTIALLY_PAID';
        invoice.updatedAt = event.createdAt.toISOString();
      }
    }

    return map;
  }

  private async getEscalationRuleMap(farmId: string) {
    const events = await prisma.event.findMany({
      where: { farmId, type: 'FARMHANDS_SLA_RULE_UPSERTED' },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const map = new Map<string, SlaEscalationRule>();
    for (const baseRule of this.defaultSlaRules) {
      map.set(baseRule.ruleId, { ...baseRule });
    }

    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const ruleId = this.readString(payload, 'ruleId') || event.id;
      const current = map.get(ruleId);
      map.set(ruleId, {
        ruleId,
        name: this.readString(payload, 'name') || current?.name || 'FarmHands SLA Rule',
        isActive: typeof payload.isActive === 'boolean' ? payload.isActive : (current?.isActive ?? true),
        maxAssignmentMinutes: this.readNumber(payload, 'maxAssignmentMinutes') || current?.maxAssignmentMinutes || 1440,
        severity: (this.readString(payload, 'severity') as SlaEscalationRule['severity']) || current?.severity || 'WARNING',
        notifyOwner: typeof payload.notifyOwner === 'boolean' ? payload.notifyOwner : (current?.notifyOwner ?? true),
        notifyManager: typeof payload.notifyManager === 'boolean' ? payload.notifyManager : (current?.notifyManager ?? true),
        createdAt: event.createdAt.toISOString(),
      });
    }

    return map;
  }

  async listContracts(farmId: string) {
    const contractMap = await this.getContractMap(farmId);
    return [...contractMap.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createContract(input: {
    farmId: string;
    userId: string;
    ownerName: string;
    packageName: 'ESSENTIAL' | 'STANDARD' | 'ENTERPRISE' | 'CUSTOM';
    serviceTypes: ContractServiceType[];
    farmSizeHectares?: number;
    startDate?: string;
    endDate?: string;
    notes?: string;
    idempotencyKey: string;
  }) {
    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      const payload = (existing.payload ?? {}) as Record<string, unknown>;
      return {
        reused: true,
        contractId: String(payload.contractId || existing.id),
      };
    }

    const contractId = `fhc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'FARMHANDS_CONTRACT_CREATED',
        payload: {
          contractId,
          ownerName: input.ownerName,
          packageName: input.packageName,
          serviceTypes: input.serviceTypes,
          farmSizeHectares: input.farmSizeHectares ?? null,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          notes: input.notes ?? '',
          status: 'ACTIVE',
        },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return {
      contractId,
      status: 'ACTIVE',
    };
  }

  async listServiceRequests(farmId: string) {
    const requestMap = await this.getServiceRequestMap(farmId);
    return [...requestMap.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async assignServiceRequest(input: {
    farmId: string;
    userId: string;
    requestId: string;
    assignedToUserId: string;
    assignedToName?: string;
    notes?: string;
    idempotencyKey: string;
  }) {
    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true };
    }

    const requestMap = await this.getServiceRequestMap(input.farmId);
    const request = requestMap.get(input.requestId);
    if (!request) {
      throw new AppError('REQUEST_NOT_FOUND', 'Service request not found', 404);
    }
    if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
      throw new AppError('REQUEST_NOT_ASSIGNABLE', 'Completed/cancelled requests cannot be reassigned', 400);
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'FARMHANDS_SERVICE_ASSIGNED',
          payload: {
            requestId: input.requestId,
            assignedToUserId: input.assignedToUserId,
            assignedToName: input.assignedToName ?? '',
            notes: input.notes ?? '',
          },
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await tx.task.create({
        data: {
          farmId: input.farmId,
          title: `FarmHands Service: ${request.type}`,
          description: request.description,
          assignedTo: input.assignedToUserId,
          dueDate: request.neededBy ? new Date(request.neededBy) : null,
          priority: request.priority === 'CRITICAL' ? 5 : request.priority === 'HIGH' ? 4 : request.priority === 'LOW' ? 2 : 3,
          status: 'PENDING',
        },
      });
    }, { isolationLevel: 'Serializable' });

    return { requestId: input.requestId, status: 'ASSIGNED' };
  }

  async updateServiceRequestStatus(input: {
    farmId: string;
    userId: string;
    requestId: string;
    status: ServiceRequestStatus;
    notes?: string;
    idempotencyKey: string;
  }) {
    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true };
    }

    const requestMap = await this.getServiceRequestMap(input.farmId);
    if (!requestMap.has(input.requestId)) {
      throw new AppError('REQUEST_NOT_FOUND', 'Service request not found', 404);
    }

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'FARMHANDS_SERVICE_STATUS_UPDATED',
        payload: {
          requestId: input.requestId,
          status: input.status,
          notes: input.notes ?? '',
        },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return { requestId: input.requestId, status: input.status };
  }

  async getSlaMetrics(farmId: string) {
    const requests = await this.listServiceRequests(farmId);
    const total = requests.length;
    const assigned = requests.filter((item: any) => item.assignedAt).length;
    const breached = requests.filter((item: any) => item.slaBreached).length;
    const inProgress = requests.filter((item: any) => item.status === 'IN_PROGRESS').length;
    const completed = requests.filter((item: any) => item.status === 'COMPLETED').length;

    const avgAssignmentMinutes = (() => {
      const durations = requests
        .filter((item: any) => item.assignedAt)
        .map((item: any) => (new Date(item.assignedAt).getTime() - new Date(item.createdAt).getTime()) / (1000 * 60))
        .filter((value: number) => Number.isFinite(value) && value >= 0);

      if (!durations.length) return null;
      return Math.round(durations.reduce((sum: number, value: number) => sum + value, 0) / durations.length);
    })();

    return {
      totals: {
        total,
        assigned,
        inProgress,
        completed,
        breached,
      },
      assignmentRatePct: total ? Math.round((assigned / total) * 100) : 0,
      slaBreachRatePct: total ? Math.round((breached / total) * 100) : 0,
      avgAssignmentMinutes,
      generatedAt: new Date().toISOString(),
    };
  }

  async listEscalationRules(farmId: string) {
    const ruleMap = await this.getEscalationRuleMap(farmId);
    return [...ruleMap.values()].sort((a, b) => a.maxAssignmentMinutes - b.maxAssignmentMinutes);
  }

  async upsertEscalationRule(input: {
    farmId: string;
    userId: string;
    ruleId?: string;
    name: string;
    isActive: boolean;
    maxAssignmentMinutes: number;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    notifyOwner: boolean;
    notifyManager: boolean;
    idempotencyKey: string;
  }) {
    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true };
    }

    const ruleId = input.ruleId || `fhsr_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'FARMHANDS_SLA_RULE_UPSERTED',
        payload: {
          ruleId,
          name: input.name,
          isActive: input.isActive,
          maxAssignmentMinutes: input.maxAssignmentMinutes,
          severity: input.severity,
          notifyOwner: input.notifyOwner,
          notifyManager: input.notifyManager,
        },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return { ruleId, status: 'UPDATED' };
  }

  async listEscalations(farmId: string) {
    const events = await prisma.event.findMany({
      where: { farmId, type: 'FARMHANDS_SLA_ESCALATED' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return events.map((event) => {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      return {
        escalationId: event.id,
        requestId: this.readString(payload, 'requestId') || '',
        ruleId: this.readString(payload, 'ruleId') || '',
        severity: this.readString(payload, 'severity') || 'WARNING',
        status: this.readString(payload, 'status') || 'OPEN',
        message: this.readString(payload, 'message') || '',
        alertId: this.readString(payload, 'alertId'),
        createdAt: event.createdAt.toISOString(),
      };
    });
  }

  async runSlaEscalationScan(input: { farmId: string; actorUserId: string }) {
    const [rules, requests, escalations] = await Promise.all([
      this.listEscalationRules(input.farmId),
      this.listServiceRequests(input.farmId),
      this.listEscalations(input.farmId),
    ]);

    const activeRules = rules.filter((rule) => rule.isActive);
    if (!activeRules.length) {
      return { scanned: requests.length, escalated: 0, skipped: requests.length, reason: 'NO_ACTIVE_RULES' as const };
    }

    const escalationByRequestId = new Map<string, { createdAt: string }>();
    for (const escalation of escalations) {
      if (escalation.requestId && !escalationByRequestId.has(escalation.requestId)) {
        escalationByRequestId.set(escalation.requestId, { createdAt: escalation.createdAt });
      }
    }

    let escalated = 0;
    let skipped = 0;

    for (const request of requests) {
      if (request.assignedAt || request.status === 'CANCELLED' || request.status === 'COMPLETED') {
        skipped += 1;
        continue;
      }

      const createdAtMs = new Date(request.createdAt).getTime();
      const ageMinutes = Math.max(0, Math.round((Date.now() - createdAtMs) / (1000 * 60)));

      const matchedRule = activeRules
        .filter((rule) => ageMinutes >= rule.maxAssignmentMinutes)
        .sort((a, b) => b.maxAssignmentMinutes - a.maxAssignmentMinutes)[0];

      if (!matchedRule) {
        skipped += 1;
        continue;
      }

      const previousEscalation = escalationByRequestId.get(request.requestId);
      if (previousEscalation && new Date(previousEscalation.createdAt).getTime() >= new Date(request.updatedAt).getTime()) {
        skipped += 1;
        continue;
      }

      const message = `SLA breach: Service request ${request.requestId} has been unassigned for ${ageMinutes} minutes (threshold ${matchedRule.maxAssignmentMinutes}).`;

      const createdAlert = await prisma.alert.create({
        data: {
          farmId: input.farmId,
          level: matchedRule.severity,
          message,
          resolved: false,
        },
      });

      await prisma.event.create({
        data: {
          farmId: input.farmId,
          type: 'FARMHANDS_SLA_ESCALATED',
          payload: {
            requestId: request.requestId,
            ruleId: matchedRule.ruleId,
            severity: matchedRule.severity,
            ageMinutes,
            thresholdMinutes: matchedRule.maxAssignmentMinutes,
            status: 'OPEN',
            message,
            alertId: createdAlert.id,
          },
          userId: input.actorUserId,
        },
      });

      await alertPreferencesService.dispatchForAlert({
        farmId: input.farmId,
        alertId: createdAlert.id,
        level: matchedRule.severity,
        message,
        userId: input.actorUserId,
      });

      escalated += 1;
    }

    return {
      scanned: requests.length,
      escalated,
      skipped,
      generatedAt: new Date().toISOString(),
    };
  }

  async requestService(input: {
    farmId: string;
    userId: string;
    contractId?: string;
    type: ServiceRequestType;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    neededBy?: string;
    headcount?: number;
    description: string;
    idempotencyKey: string;
  }) {
    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      const payload = (existing.payload ?? {}) as Record<string, unknown>;
      return {
        reused: true,
        requestId: String(payload.requestId || existing.id),
      };
    }

    const requestId = `fhr_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'FARMHANDS_SERVICE_REQUESTED',
        payload: {
          requestId,
          contractId: input.contractId ?? null,
          type: input.type,
          priority: input.priority,
          neededBy: input.neededBy ?? null,
          headcount: input.headcount ?? null,
          description: input.description,
          status: 'PENDING_ASSIGNMENT',
        },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return {
      requestId,
      status: 'PENDING_ASSIGNMENT',
    };
  }

  getInputCatalog() {
    return this.inputCatalog;
  }

  async listInputOrders(farmId: string) {
    return prisma.purchaseOrder.findMany({
      where: {
        farmId,
        vendor: { name: this.fulfillmentVendorName },
      },
      include: {
        items: true,
        vendor: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateInputOrderStatus(input: {
    farmId: string;
    userId: string;
    poId: string;
    status: 'ISSUED' | 'DELIVERED' | 'RECONCILED' | 'CANCELLED';
    notes?: string;
    idempotencyKey: string;
  }) {
    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true };
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: {
        id: input.poId,
        farmId: input.farmId,
        vendor: { name: this.fulfillmentVendorName },
      },
    });

    if (!po) {
      throw new AppError('INPUT_ORDER_NOT_FOUND', 'Input order not found', 404);
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: input.status },
      });

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'FARMHANDS_INPUT_ORDER_STATUS_UPDATED',
          payload: {
            poId: input.poId,
            status: input.status,
            notes: input.notes ?? '',
          },
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });
    }, { isolationLevel: 'Serializable' });

    return { poId: input.poId, status: input.status };
  }

  async listInvoices(farmId: string) {
    const invoiceMap = await this.getInvoiceMap(farmId);
    return [...invoiceMap.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createInvoice(input: {
    farmId: string;
    userId: string;
    referenceType: 'CONTRACT' | 'SERVICE_REQUEST' | 'INPUT_ORDER';
    referenceId: string;
    amount: number;
    currency?: string;
    dueDate?: string;
    notes?: string;
    idempotencyKey: string;
  }) {
    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      const payload = (existing.payload ?? {}) as Record<string, unknown>;
      return { reused: true, invoiceId: this.readString(payload, 'invoiceId') || existing.id };
    }

    const invoiceId = `fhi_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'FARMHANDS_INVOICE_CREATED',
        payload: {
          invoiceId,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          amount: input.amount,
          currency: input.currency || 'USD',
          dueDate: input.dueDate ?? null,
          notes: input.notes ?? '',
          status: 'ISSUED',
        },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return { invoiceId, status: 'ISSUED' };
  }

  async settleInvoice(input: {
    farmId: string;
    userId: string;
    invoiceId: string;
    paidAmount: number;
    paymentMethod: 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CARD' | 'CASH';
    reference?: string;
    idempotencyKey: string;
  }) {
    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true };
    }

    const invoices = await this.listInvoices(input.farmId);
    const invoice = invoices.find((item: any) => item.invoiceId === input.invoiceId);
    if (!invoice) {
      throw new AppError('INVOICE_NOT_FOUND', 'Invoice not found', 404);
    }
    if (invoice.status === 'PAID') {
      throw new AppError('INVOICE_ALREADY_PAID', 'Invoice is already paid', 400);
    }

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'FARMHANDS_INVOICE_SETTLED',
        payload: {
          invoiceId: input.invoiceId,
          paidAmount: input.paidAmount,
          paymentMethod: input.paymentMethod,
          reference: input.reference ?? '',
        },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return {
      invoiceId: input.invoiceId,
      status: invoice.paidAmount + input.paidAmount >= invoice.amount ? 'PAID' : 'PARTIALLY_PAID',
    };
  }

  async renewContract(input: {
    farmId: string;
    userId: string;
    contractId: string;
    newEndDate: string;
    renewalNotes?: string;
    idempotencyKey: string;
  }) {
    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true };
    }

    const contracts = await this.listContracts(input.farmId);
    const contract = contracts.find((item: any) => item.contractId === input.contractId);
    if (!contract) {
      throw new AppError('CONTRACT_NOT_FOUND', 'FarmHands contract not found', 404);
    }

    await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'FARMHANDS_CONTRACT_RENEWED',
        payload: {
          contractId: input.contractId,
          previousEndDate: contract.endDate ?? null,
          newEndDate: input.newEndDate,
          renewalNotes: input.renewalNotes ?? '',
          status: 'ACTIVE',
        },
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return { contractId: input.contractId, status: 'ACTIVE', newEndDate: input.newEndDate };
  }

  async placeInputOrder(input: {
    farmId: string;
    userId: string;
    contractId?: string;
    serviceRequestId?: string;
    notes?: string;
    items: Array<{
      sku: string;
      description: string;
      qty: number;
      unitPrice: number;
    }>;
    idempotencyKey: string;
  }) {
    if (!input.items.length) {
      throw new AppError('INVALID_INPUT_ORDER', 'At least one item is required', 400);
    }

    const existing = await this.ensureEventIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      const payload = (existing.payload ?? {}) as Record<string, unknown>;
      return {
        reused: true,
        poId: String(payload.poId || ''),
      };
    }

    const result = await runSerializableTransactionWithRetry(async (tx: any) => {
      let vendor = await tx.vendor.findFirst({
        where: {
          farmId: input.farmId,
          name: this.fulfillmentVendorName,
        },
      });

      if (!vendor) {
        vendor = await tx.vendor.create({
          data: {
            farmId: input.farmId,
            name: this.fulfillmentVendorName,
            contactInfo: {
              source: 'FARMHANDS_PLATFORM',
              channel: 'ops@farmhands.local',
            },
          },
        });
      }

      const po = await tx.purchaseOrder.create({
        data: {
          farmId: input.farmId,
          vendorId: vendor.id,
          status: 'ISSUED',
          items: {
            create: input.items.map((item) => ({
              description: `${item.description} [${item.sku}]`,
              qty: item.qty,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: { items: true, vendor: true },
      });

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'FARMHANDS_INPUT_ORDER_PLACED',
          payload: {
            poId: po.id,
            contractId: input.contractId ?? null,
            serviceRequestId: input.serviceRequestId ?? null,
            notes: input.notes ?? '',
            itemCount: input.items.length,
            totalAmount: input.items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0),
          },
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      return po;
    });

    return result;
  }
}

export const farmhandsService = new FarmhandsService();
