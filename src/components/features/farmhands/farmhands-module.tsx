'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { getFarmData, postFarmData } from '@/lib/api/farm-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

type CatalogItem = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  defaultUnitPrice: number;
};

type FarmhandsSla = {
  totals: {
    total: number;
    assigned: number;
    inProgress: number;
    completed: number;
    breached: number;
  };
  assignmentRatePct: number;
  slaBreachRatePct: number;
  avgAssignmentMinutes: number | null;
  generatedAt: string;
};

type EscalationRule = {
  ruleId: string;
  name: string;
  isActive: boolean;
  maxAssignmentMinutes: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  notifyOwner: boolean;
  notifyManager: boolean;
};

export function FarmhandsModule() {
  const { farmId } = useAuth();
  const [ownerName, setOwnerName] = useState('');
  const [packageName, setPackageName] = useState<'ESSENTIAL' | 'STANDARD' | 'ENTERPRISE' | 'CUSTOM'>('STANDARD');
  const [contractServiceType, setContractServiceType] = useState('LABOR_SUPPLY');
  const [contractNotes, setContractNotes] = useState('');

  const [requestType, setRequestType] = useState('LABOR');
  const [requestPriority, setRequestPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL');
  const [requestHeadcount, setRequestHeadcount] = useState(8);
  const [requestDescription, setRequestDescription] = useState('Need 8 workers for weeding and cleanup on field A.');

  const [selectedSku, setSelectedSku] = useState('');
  const [orderQty, setOrderQty] = useState(1);
  const [orderNotes, setOrderNotes] = useState('Deliver inputs to main farm gate before 8am.');

  const [assignRequestId, setAssignRequestId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignName, setAssignName] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  const [statusRequestId, setStatusRequestId] = useState('');
  const [nextStatus, setNextStatus] = useState<'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>('IN_PROGRESS');
  const [statusNotes, setStatusNotes] = useState('');

  const [lifecyclePoId, setLifecyclePoId] = useState('');
  const [lifecycleStatus, setLifecycleStatus] = useState<'ISSUED' | 'DELIVERED' | 'RECONCILED' | 'CANCELLED'>('DELIVERED');
  const [lifecycleNotes, setLifecycleNotes] = useState('');

  const [invoiceReferenceType, setInvoiceReferenceType] = useState<'CONTRACT' | 'SERVICE_REQUEST' | 'INPUT_ORDER'>('CONTRACT');
  const [invoiceReferenceId, setInvoiceReferenceId] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const [settleInvoiceId, setSettleInvoiceId] = useState('');
  const [settleAmount, setSettleAmount] = useState(0);
  const [settleMethod, setSettleMethod] = useState<'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CARD' | 'CASH'>('BANK_TRANSFER');
  const [settleReference, setSettleReference] = useState('');

  const [renewContractId, setRenewContractId] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewNotes, setRenewNotes] = useState('');

  const [ruleName, setRuleName] = useState('Escalate unassigned requests');
  const [ruleMaxMinutes, setRuleMaxMinutes] = useState(240);
  const [ruleSeverity, setRuleSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');
  const [ruleNotifyOwner, setRuleNotifyOwner] = useState(true);
  const [ruleNotifyManager, setRuleNotifyManager] = useState(true);

  const contractsQuery = useQuery({
    queryKey: ['farmhands-contracts', farmId],
    queryFn: () => getFarmData<any[]>(farmId!, '/farmhands/contracts'),
    enabled: Boolean(farmId),
  });

  const serviceRequestsQuery = useQuery({
    queryKey: ['farmhands-service-requests', farmId],
    queryFn: () => getFarmData<any[]>(farmId!, '/farmhands/service-requests'),
    enabled: Boolean(farmId),
  });

  const catalogQuery = useQuery({
    queryKey: ['farmhands-catalog', farmId],
    queryFn: () => getFarmData<CatalogItem[]>(farmId!, '/farmhands/input-catalog'),
    enabled: Boolean(farmId),
  });

  const inputOrdersQuery = useQuery({
    queryKey: ['farmhands-input-orders', farmId],
    queryFn: () => getFarmData<any[]>(farmId!, '/farmhands/input-orders'),
    enabled: Boolean(farmId),
  });

  const invoicesQuery = useQuery({
    queryKey: ['farmhands-invoices', farmId],
    queryFn: () => getFarmData<any[]>(farmId!, '/farmhands/invoices'),
    enabled: Boolean(farmId),
  });

  const slaQuery = useQuery({
    queryKey: ['farmhands-sla', farmId],
    queryFn: () => getFarmData<FarmhandsSla>(farmId!, '/farmhands/sla'),
    enabled: Boolean(farmId),
    refetchInterval: 30_000,
  });

  const rulesQuery = useQuery({
    queryKey: ['farmhands-escalation-rules', farmId],
    queryFn: () => getFarmData<EscalationRule[]>(farmId!, '/farmhands/escalation-rules'),
    enabled: Boolean(farmId),
  });

  const escalationsQuery = useQuery({
    queryKey: ['farmhands-escalations', farmId],
    queryFn: () => getFarmData<any[]>(farmId!, '/farmhands/escalations'),
    enabled: Boolean(farmId),
    refetchInterval: 30_000,
  });

  const selectedCatalogItem = useMemo(
    () => (catalogQuery.data || []).find((item) => item.sku === selectedSku) || null,
    [catalogQuery.data, selectedSku],
  );

  const createContractMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/farmhands/contracts', {
      ownerName,
      packageName,
      serviceTypes: [contractServiceType],
      notes: contractNotes || undefined,
      idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      setContractNotes('');
      void contractsQuery.refetch();
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/farmhands/service-requests', {
      type: requestType,
      priority: requestPriority,
      headcount: requestHeadcount > 0 ? requestHeadcount : undefined,
      description: requestDescription,
      idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      void serviceRequestsQuery.refetch();
    },
  });

  const placeOrderMutation = useMutation({
    mutationFn: () => {
      if (!selectedCatalogItem) {
        throw new Error('Select an input item first');
      }

      return postFarmData(farmId!, '/farmhands/input-orders', {
        notes: orderNotes || undefined,
        idempotencyKey: crypto.randomUUID(),
        items: [
          {
            sku: selectedCatalogItem.sku,
            description: selectedCatalogItem.name,
            qty: orderQty,
            unitPrice: selectedCatalogItem.defaultUnitPrice,
          },
        ],
      });
    },
    onSuccess: () => {
      setOrderQty(1);
      void inputOrdersQuery.refetch();
    },
  });

  const assignRequestMutation = useMutation({
    mutationFn: () => {
      const requestId = assignRequestId.trim();
      return postFarmData(farmId!, `/farmhands/service-requests/${requestId}/assign`, {
        assignedToUserId: assignUserId,
        assignedToName: assignName || undefined,
        notes: assignNotes || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setAssignNotes('');
      void serviceRequestsQuery.refetch();
      void slaQuery.refetch();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: () => {
      const requestId = statusRequestId.trim();
      return postFarmData(farmId!, `/farmhands/service-requests/${requestId}/status`, {
        status: nextStatus,
        notes: statusNotes || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setStatusNotes('');
      void serviceRequestsQuery.refetch();
      void slaQuery.refetch();
    },
  });

  const updateLifecycleMutation = useMutation({
    mutationFn: () => {
      const poId = lifecyclePoId.trim();
      return postFarmData(farmId!, `/farmhands/input-orders/${poId}/status`, {
        status: lifecycleStatus,
        notes: lifecycleNotes || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setLifecycleNotes('');
      void inputOrdersQuery.refetch();
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/farmhands/invoices', {
      referenceType: invoiceReferenceType,
      referenceId: invoiceReferenceId,
      amount: invoiceAmount,
      dueDate: invoiceDueDate || undefined,
      notes: invoiceNotes || undefined,
      idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      setInvoiceNotes('');
      setInvoiceAmount(0);
      void invoicesQuery.refetch();
    },
  });

  const settleInvoiceMutation = useMutation({
    mutationFn: () => {
      const invoiceId = settleInvoiceId.trim();
      return postFarmData(farmId!, `/farmhands/invoices/${invoiceId}/settle`, {
        paidAmount: settleAmount,
        paymentMethod: settleMethod,
        reference: settleReference || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setSettleAmount(0);
      setSettleReference('');
      void invoicesQuery.refetch();
    },
  });

  const renewContractMutation = useMutation({
    mutationFn: () => {
      const contractId = renewContractId.trim();
      return postFarmData(farmId!, `/farmhands/contracts/${contractId}/renew`, {
        newEndDate: renewEndDate,
        renewalNotes: renewNotes || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setRenewNotes('');
      setRenewEndDate('');
      void contractsQuery.refetch();
    },
  });

  const upsertRuleMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/farmhands/escalation-rules', {
      name: ruleName,
      isActive: true,
      maxAssignmentMinutes: ruleMaxMinutes,
      severity: ruleSeverity,
      notifyOwner: ruleNotifyOwner,
      notifyManager: ruleNotifyManager,
      idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      void rulesQuery.refetch();
    },
  });

  const runEscalationScanMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/farmhands/escalations/run', {
      idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      void escalationsQuery.refetch();
      void slaQuery.refetch();
    },
  });

  const latestContracts = (contractsQuery.data || []).slice(0, 6);
  const latestRequests = (serviceRequestsQuery.data || []).slice(0, 6);
  const latestOrders = (inputOrdersQuery.data || []).slice(0, 6);
  const latestInvoices = (invoicesQuery.data || []).slice(0, 6);
  const latestEscalations = (escalationsQuery.data || []).slice(0, 6);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">FarmHands Contracts</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">
          Enterprise v2: SLA tracking, assignment engine, delivery lifecycle, invoicing, settlement, renewals
        </p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">SLA Tracking</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <div className="rounded-md bg-accent/20 p-2 text-xs"><p>Total</p><p className="font-bold text-sm">{slaQuery.data?.totals.total ?? 0}</p></div>
          <div className="rounded-md bg-accent/20 p-2 text-xs"><p>Assigned</p><p className="font-bold text-sm">{slaQuery.data?.totals.assigned ?? 0}</p></div>
          <div className="rounded-md bg-accent/20 p-2 text-xs"><p>In Progress</p><p className="font-bold text-sm">{slaQuery.data?.totals.inProgress ?? 0}</p></div>
          <div className="rounded-md bg-accent/20 p-2 text-xs"><p>Completed</p><p className="font-bold text-sm">{slaQuery.data?.totals.completed ?? 0}</p></div>
          <div className="rounded-md bg-accent/20 p-2 text-xs"><p>Breach %</p><p className="font-bold text-sm">{slaQuery.data?.slaBreachRatePct ?? 0}%</p></div>
          <div className="rounded-md bg-accent/20 p-2 text-xs"><p>Avg Assign</p><p className="font-bold text-sm">{slaQuery.data?.avgAssignmentMinutes ?? '-'}m</p></div>
        </div>
        <button
          onClick={() => runEscalationScanMutation.mutate()}
          disabled={runEscalationScanMutation.isPending}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {runEscalationScanMutation.isPending ? 'Running Scan...' : 'Run SLA Escalation Scan Now'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Escalation Rules</h2>
        <input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder="Rule name" className="w-full h-10 rounded-md px-3 text-sm" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input type="number" value={ruleMaxMinutes} onChange={(event) => setRuleMaxMinutes(Number(event.target.value))} placeholder="Max assignment minutes" className="w-full h-10 rounded-md px-3 text-sm" />
          <select value={ruleSeverity} onChange={(event) => setRuleSeverity(event.target.value as typeof ruleSeverity)} className="w-full h-10 rounded-md px-3 text-sm">
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" checked={ruleNotifyOwner} onChange={(event) => setRuleNotifyOwner(event.target.checked)} /> Notify owner</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={ruleNotifyManager} onChange={(event) => setRuleNotifyManager(event.target.checked)} /> Notify manager</label>
        </div>
        <button
          onClick={() => upsertRuleMutation.mutate()}
          disabled={upsertRuleMutation.isPending || ruleName.trim().length < 3 || ruleMaxMinutes <= 0}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {upsertRuleMutation.isPending ? 'Saving Rule...' : 'Save Escalation Rule'}
        </button>
        <div className="space-y-2">
          {(rulesQuery.data || []).slice(0, 6).map((rule) => (
            <div key={rule.ruleId} className="p-2 rounded-md bg-accent/20 text-xs">
              <p className="font-semibold">{rule.name}</p>
              <p className="text-muted-foreground">{rule.maxAssignmentMinutes} min · {rule.severity} · {rule.isActive ? 'Active' : 'Inactive'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Create Owner Contract</h2>
        <input
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
          placeholder="Farm owner name"
          className="w-full h-10 rounded-md px-3 text-sm"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={packageName}
            onChange={(event) => setPackageName(event.target.value as typeof packageName)}
            className="w-full h-10 rounded-md px-3 text-sm"
          >
            <option value="ESSENTIAL">Essential</option>
            <option value="STANDARD">Standard</option>
            <option value="ENTERPRISE">Enterprise</option>
            <option value="CUSTOM">Custom</option>
          </select>
          <select
            value={contractServiceType}
            onChange={(event) => setContractServiceType(event.target.value)}
            className="w-full h-10 rounded-md px-3 text-sm"
          >
            <option value="LABOR_SUPPLY">Labor Supply</option>
            <option value="FARM_MANAGER">Farm Manager</option>
            <option value="INPUT_SUPPLY">Input Supply</option>
            <option value="FIELD_OPERATIONS">Field Operations</option>
            <option value="MECHANIZATION">Mechanization</option>
            <option value="CROP_PROTECTION">Crop Protection</option>
          </select>
        </div>
        <textarea
          value={contractNotes}
          onChange={(event) => setContractNotes(event.target.value)}
          placeholder="Contract notes"
          className="w-full rounded-md px-3 py-2 text-sm"
          rows={3}
        />
        <button
          onClick={() => createContractMutation.mutate()}
          disabled={createContractMutation.isPending || !ownerName}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {createContractMutation.isPending ? 'Creating Contract...' : 'Create Contract'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Request Labor or Farm Service</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={requestType}
            onChange={(event) => setRequestType(event.target.value)}
            className="w-full h-10 rounded-md px-3 text-sm"
          >
            <option value="LABOR">Labor</option>
            <option value="WORKER_REPLACEMENT">Worker Replacement</option>
            <option value="FARM_MANAGER_SUPPORT">Farm Manager Support</option>
            <option value="INPUT_DELIVERY">Input Delivery</option>
            <option value="SPRAYING">Spraying Team</option>
            <option value="HARVEST_SUPPORT">Harvest Support</option>
          </select>
          <select
            value={requestPriority}
            onChange={(event) => setRequestPriority(event.target.value as typeof requestPriority)}
            className="w-full h-10 rounded-md px-3 text-sm"
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <input
          type="number"
          value={requestHeadcount}
          onChange={(event) => setRequestHeadcount(Number(event.target.value))}
          placeholder="Headcount"
          className="w-full h-10 rounded-md px-3 text-sm"
        />
        <textarea
          value={requestDescription}
          onChange={(event) => setRequestDescription(event.target.value)}
          placeholder="Describe the exact work you want FarmHands to execute"
          className="w-full rounded-md px-3 py-2 text-sm"
          rows={3}
        />
        <button
          onClick={() => createRequestMutation.mutate()}
          disabled={createRequestMutation.isPending || requestDescription.trim().length < 5}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {createRequestMutation.isPending ? 'Submitting Request...' : 'Submit Service Request'}
        </button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border rounded-xl bg-card space-y-2">
          <h2 className="text-sm font-bold uppercase">Assignment Engine</h2>
          <input value={assignRequestId} onChange={(event) => setAssignRequestId(event.target.value)} placeholder="Service Request ID" className="w-full h-10 rounded-md px-3 text-sm" />
          <input value={assignUserId} onChange={(event) => setAssignUserId(event.target.value)} placeholder="Assign To User ID" className="w-full h-10 rounded-md px-3 text-sm" />
          <input value={assignName} onChange={(event) => setAssignName(event.target.value)} placeholder="Assign To Name (optional)" className="w-full h-10 rounded-md px-3 text-sm" />
          <input value={assignNotes} onChange={(event) => setAssignNotes(event.target.value)} placeholder="Assignment notes" className="w-full h-10 rounded-md px-3 text-sm" />
          <button onClick={() => assignRequestMutation.mutate()} disabled={assignRequestMutation.isPending || !assignRequestId || !assignUserId} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {assignRequestMutation.isPending ? 'Assigning...' : 'Assign Request'}
          </button>
        </div>

        <div className="p-4 border rounded-xl bg-card space-y-2">
          <h2 className="text-sm font-bold uppercase">Service Status Lifecycle</h2>
          <input value={statusRequestId} onChange={(event) => setStatusRequestId(event.target.value)} placeholder="Service Request ID" className="w-full h-10 rounded-md px-3 text-sm" />
          <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as typeof nextStatus)} className="w-full h-10 rounded-md px-3 text-sm">
            <option value="PENDING_ASSIGNMENT">Pending Assignment</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <input value={statusNotes} onChange={(event) => setStatusNotes(event.target.value)} placeholder="Status notes" className="w-full h-10 rounded-md px-3 text-sm" />
          <button onClick={() => updateStatusMutation.mutate()} disabled={updateStatusMutation.isPending || !statusRequestId} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {updateStatusMutation.isPending ? 'Updating...' : 'Update Request Status'}
          </button>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Order Farm Inputs</h2>
        <select
          value={selectedSku}
          onChange={(event) => setSelectedSku(event.target.value)}
          className="w-full h-10 rounded-md px-3 text-sm"
        >
          <option value="">Select input item</option>
          {(catalogQuery.data || []).map((item) => (
            <option key={item.sku} value={item.sku}>
              {item.name} ({item.category}) - {item.defaultUnitPrice}/{item.unit}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={orderQty}
          onChange={(event) => setOrderQty(Number(event.target.value))}
          placeholder="Quantity"
          className="w-full h-10 rounded-md px-3 text-sm"
        />
        <textarea
          value={orderNotes}
          onChange={(event) => setOrderNotes(event.target.value)}
          placeholder="Delivery notes"
          className="w-full rounded-md px-3 py-2 text-sm"
          rows={2}
        />
        <button
          onClick={() => placeOrderMutation.mutate()}
          disabled={placeOrderMutation.isPending || !selectedCatalogItem || orderQty <= 0}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {placeOrderMutation.isPending ? 'Placing Order...' : 'Place Input Order'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Delivery Status Lifecycle</h2>
        <input value={lifecyclePoId} onChange={(event) => setLifecyclePoId(event.target.value)} placeholder="Input Order (PO) ID" className="w-full h-10 rounded-md px-3 text-sm" />
        <select value={lifecycleStatus} onChange={(event) => setLifecycleStatus(event.target.value as typeof lifecycleStatus)} className="w-full h-10 rounded-md px-3 text-sm">
          <option value="ISSUED">Issued</option>
          <option value="DELIVERED">Delivered</option>
          <option value="RECONCILED">Reconciled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <input value={lifecycleNotes} onChange={(event) => setLifecycleNotes(event.target.value)} placeholder="Lifecycle notes" className="w-full h-10 rounded-md px-3 text-sm" />
        <button onClick={() => updateLifecycleMutation.mutate()} disabled={updateLifecycleMutation.isPending || !lifecyclePoId} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {updateLifecycleMutation.isPending ? 'Updating...' : 'Update Delivery Status'}
        </button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border rounded-xl bg-card space-y-2">
          <h2 className="text-sm font-bold uppercase">Invoicing</h2>
          <select value={invoiceReferenceType} onChange={(event) => setInvoiceReferenceType(event.target.value as typeof invoiceReferenceType)} className="w-full h-10 rounded-md px-3 text-sm">
            <option value="CONTRACT">Contract</option>
            <option value="SERVICE_REQUEST">Service Request</option>
            <option value="INPUT_ORDER">Input Order</option>
          </select>
          <input value={invoiceReferenceId} onChange={(event) => setInvoiceReferenceId(event.target.value)} placeholder="Reference ID" className="w-full h-10 rounded-md px-3 text-sm" />
          <input type="number" value={invoiceAmount} onChange={(event) => setInvoiceAmount(Number(event.target.value))} placeholder="Amount" className="w-full h-10 rounded-md px-3 text-sm" />
          <input type="date" value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} className="w-full h-10 rounded-md px-3 text-sm" />
          <input value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} placeholder="Invoice notes" className="w-full h-10 rounded-md px-3 text-sm" />
          <button onClick={() => createInvoiceMutation.mutate()} disabled={createInvoiceMutation.isPending || !invoiceReferenceId || invoiceAmount <= 0} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {createInvoiceMutation.isPending ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>

        <div className="p-4 border rounded-xl bg-card space-y-2">
          <h2 className="text-sm font-bold uppercase">Settlement</h2>
          <input value={settleInvoiceId} onChange={(event) => setSettleInvoiceId(event.target.value)} placeholder="Invoice ID" className="w-full h-10 rounded-md px-3 text-sm" />
          <input type="number" value={settleAmount} onChange={(event) => setSettleAmount(Number(event.target.value))} placeholder="Paid amount" className="w-full h-10 rounded-md px-3 text-sm" />
          <select value={settleMethod} onChange={(event) => setSettleMethod(event.target.value as typeof settleMethod)} className="w-full h-10 rounded-md px-3 text-sm">
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
          </select>
          <input value={settleReference} onChange={(event) => setSettleReference(event.target.value)} placeholder="Payment reference" className="w-full h-10 rounded-md px-3 text-sm" />
          <button onClick={() => settleInvoiceMutation.mutate()} disabled={settleInvoiceMutation.isPending || !settleInvoiceId || settleAmount <= 0} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {settleInvoiceMutation.isPending ? 'Settling...' : 'Settle Invoice'}
          </button>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Contract Renewal</h2>
        <input value={renewContractId} onChange={(event) => setRenewContractId(event.target.value)} placeholder="Contract ID" className="w-full h-10 rounded-md px-3 text-sm" />
        <input type="date" value={renewEndDate} onChange={(event) => setRenewEndDate(event.target.value)} className="w-full h-10 rounded-md px-3 text-sm" />
        <input value={renewNotes} onChange={(event) => setRenewNotes(event.target.value)} placeholder="Renewal terms/notes" className="w-full h-10 rounded-md px-3 text-sm" />
        <button onClick={() => renewContractMutation.mutate()} disabled={renewContractMutation.isPending || !renewContractId || !renewEndDate} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {renewContractMutation.isPending ? 'Renewing...' : 'Renew Contract'}
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="p-4 border rounded-xl bg-card">
          <h3 className="text-sm font-bold uppercase mb-3">Contracts</h3>
          <div className="space-y-2">
            {latestContracts.map((contract: any) => (
              <div key={contract.contractId} className="p-2 rounded-md bg-accent/20 text-xs">
                <p className="font-semibold">{contract.ownerName || 'Owner'} · {contract.packageName}</p>
                <p className="text-muted-foreground">{contract.status} · Renewals {contract.renewalCount ?? 0}</p>
              </div>
            ))}
            {!contractsQuery.data?.length ? <p className="text-xs text-muted-foreground">No contracts yet.</p> : null}
          </div>
        </div>

        <div className="p-4 border rounded-xl bg-card">
          <h3 className="text-sm font-bold uppercase mb-3">Service Requests</h3>
          <div className="space-y-2">
            {latestRequests.map((request: any) => (
              <div key={request.requestId} className="p-2 rounded-md bg-accent/20 text-xs">
                <p className="font-semibold">{request.type} · {request.priority}</p>
                <p className="text-muted-foreground">{request.status} · SLA {request.slaBreached ? 'Breached' : 'OK'}</p>
              </div>
            ))}
            {!serviceRequestsQuery.data?.length ? <p className="text-xs text-muted-foreground">No service requests yet.</p> : null}
          </div>
        </div>

        <div className="p-4 border rounded-xl bg-card">
          <h3 className="text-sm font-bold uppercase mb-3">Input Orders</h3>
          <div className="space-y-2">
            {latestOrders.map((order: any) => (
              <div key={order.id} className="p-2 rounded-md bg-accent/20 text-xs">
                <p className="font-semibold">{order.id.slice(0, 10)}</p>
                <p className="text-muted-foreground">{order.status}</p>
              </div>
            ))}
            {!inputOrdersQuery.data?.length ? <p className="text-xs text-muted-foreground">No input orders yet.</p> : null}
          </div>
        </div>

        <div className="p-4 border rounded-xl bg-card">
          <h3 className="text-sm font-bold uppercase mb-3">Invoices</h3>
          <div className="space-y-2">
            {latestInvoices.map((invoice: any) => (
              <div key={invoice.invoiceId} className="p-2 rounded-md bg-accent/20 text-xs">
                <p className="font-semibold">{invoice.invoiceId}</p>
                <p className="text-muted-foreground">{invoice.status} · {invoice.paidAmount}/{invoice.amount} {invoice.currency}</p>
              </div>
            ))}
            {!invoicesQuery.data?.length ? <p className="text-xs text-muted-foreground">No invoices yet.</p> : null}
          </div>
        </div>

        <div className="p-4 border rounded-xl bg-card">
          <h3 className="text-sm font-bold uppercase mb-3">Escalations</h3>
          <div className="space-y-2">
            {latestEscalations.map((escalation: any) => (
              <div key={escalation.escalationId} className="p-2 rounded-md bg-accent/20 text-xs">
                <p className="font-semibold">{escalation.severity} · {escalation.requestId}</p>
                <p className="text-muted-foreground">{escalation.status}</p>
              </div>
            ))}
            {!escalationsQuery.data?.length ? <p className="text-xs text-muted-foreground">No escalations yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
