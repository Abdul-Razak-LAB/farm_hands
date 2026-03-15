'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/components/layout/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { getFarmData } from '@/lib/api/farm-client';
import type { DomainRecentRecord, OperationsDetailReport, ReportSummary, TransactionReport } from '@/lib/api/contracts';

type OperationsDomainKey =
  | 'market'
  | 'updates'
  | 'digest'
  | 'procurement'
  | 'payroll'
  | 'monitoring'
  | 'incident'
  | 'message'
  | 'consultation'
  | 'vendor'
  | 'farmhands'
  | 'audit';

type SupportedCurrency = 'GHS' | 'USD' | 'EUR' | 'GBP';

type OperationsBlock = {
  key: OperationsDomainKey;
  title: string;
  stats: string[];
  recent: DomainRecentRecord[];
};

export function ReportsModule() {
  const { farmId } = useAuth();

  const today = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);
  const defaultStart = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return start.toISOString().slice(0, 10);
  }, []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [selectedOperationsDomain, setSelectedOperationsDomain] = useState<OperationsDomainKey>('market');
  const [currency, setCurrency] = useState<SupportedCurrency>('GHS');

  const currencySymbolMap: Record<SupportedCurrency, string> = {
    GHS: 'GH₵',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };

  const formatMoney = (value: number | null | undefined) => {
    const safeValue = Number(value ?? 0);
    return `${currencySymbolMap[currency]}${safeValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const periodDays = useMemo(() => {
    if (!startDate || !endDate) return 30;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 30;
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;

    if (diff <= 0) return 1;
    return Math.min(diff, 365);
  }, [endDate, startDate]);

  const summaryQuery = useQuery({
    queryKey: ['farm-reports', farmId, periodDays],
    queryFn: () => getFarmData<ReportSummary>(farmId!, `/reports?format=json&periodDays=${periodDays}`),
    enabled: Boolean(farmId),
  });

  const transactionsQuery = useQuery({
    queryKey: ['farm-transaction-reports', farmId, periodDays],
    queryFn: () => getFarmData<TransactionReport>(farmId!, `/reports?format=json&periodDays=${periodDays}&reportType=transactions`),
    enabled: Boolean(farmId),
  });

  const operationsQuery = useQuery({
    queryKey: ['farm-operations-reports', farmId, periodDays],
    queryFn: () => getFarmData<OperationsDetailReport>(farmId!, `/reports?format=json&periodDays=${periodDays}&reportType=operations`),
    enabled: Boolean(farmId),
  });

  const summary = summaryQuery.data;
  const transactionReport = transactionsQuery.data;
  const operationsReport = operationsQuery.data;

  const operationsBlocks = useMemo<OperationsBlock[]>(() => {
    if (!operationsReport) {
      return [];
    }

    return [
      {
        key: 'market',
        title: 'Market',
        stats: [
          `Active: ${operationsReport.market.activeListings}`,
          `Interests: ${operationsReport.market.openInterests}`,
        ],
        recent: operationsReport.market.recent,
      },
      {
        key: 'updates',
        title: 'Updates',
        stats: [`Total: ${operationsReport.updates.totalUpdates}`],
        recent: operationsReport.updates.recent,
      },
      {
        key: 'digest',
        title: 'Digest',
        stats: [`Snapshots: ${operationsReport.digest.snapshots}`],
        recent: operationsReport.digest.recent,
      },
      {
        key: 'procurement',
        title: 'Procurement',
        stats: [
          `POs: ${operationsReport.procurement.purchaseOrders}`,
          `Issued/Delivered: ${operationsReport.procurement.issuedOrDelivered}`,
        ],
        recent: operationsReport.procurement.recent,
      },
      {
        key: 'payroll',
        title: 'Payroll',
        stats: [
          `Runs: ${operationsReport.payroll.runs}`,
          `Net Pay: ${formatMoney(operationsReport.payroll.totalNetPay)}`,
        ],
        recent: operationsReport.payroll.recent,
      },
      {
        key: 'monitoring',
        title: 'Monitor',
        stats: [
          `Alerts: ${operationsReport.monitoring.alerts}`,
          `Unresolved: ${operationsReport.monitoring.unresolvedAlerts}`,
        ],
        recent: operationsReport.monitoring.recent,
      },
      {
        key: 'incident',
        title: 'Incident',
        stats: [
          `Reported: ${operationsReport.incident.reported}`,
          `Open: ${operationsReport.incident.openSignals}`,
        ],
        recent: operationsReport.incident.recent,
      },
      {
        key: 'message',
        title: 'Message',
        stats: [
          `Messages: ${operationsReport.message.totalMessages}`,
          `With Attachments: ${operationsReport.message.withAttachments}`,
        ],
        recent: operationsReport.message.recent,
      },
      {
        key: 'consultation',
        title: 'Consultation',
        stats: [
          `Requested: ${operationsReport.consultation.requested}`,
          `Resolved: ${operationsReport.consultation.resolved}`,
        ],
        recent: operationsReport.consultation.recent,
      },
      {
        key: 'vendor',
        title: 'Vendor',
        stats: [
          `Vendors: ${operationsReport.vendor.vendors}`,
          `Confirmed Orders: ${operationsReport.vendor.confirmedOrders}`,
        ],
        recent: operationsReport.vendor.recent,
      },
      {
        key: 'farmhands',
        title: 'Farmhands',
        stats: [
          `Workers: ${operationsReport.farmhands.workers}`,
          `Events: ${operationsReport.farmhands.events}`,
        ],
        recent: operationsReport.farmhands.recent,
      },
      {
        key: 'audit',
        title: 'Audit',
        stats: [
          `Audits: ${operationsReport.audit.audits}`,
          `Results: ${operationsReport.audit.auditResults}`,
        ],
        recent: operationsReport.audit.recent,
      },
    ];
  }, [operationsReport]);

  const selectedOperationsBlock = operationsBlocks.find((entry) => entry.key === selectedOperationsDomain)
    ?? operationsBlocks[0]
    ?? null;

  const download = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!farmId) return;
    const response = await fetch(`/api/farms/${farmId}/reports?format=${format}&periodDays=${periodDays}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `farm-report-${farmId}.${format === 'excel' ? 'xls' : format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadTransactions = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!farmId) return;
    const response = await fetch(`/api/farms/${farmId}/reports?format=${format}&periodDays=${periodDays}&reportType=transactions`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `farm-transaction-report-${farmId}.${format === 'excel' ? 'xls' : format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Reporting & Analytics</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Farm performance insights and exports</p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Date Range</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-muted-foreground">
            Start
            <input
              type="date"
              value={startDate}
              max={endDate || today}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm font-normal text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-muted-foreground">
            End
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={today}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm font-normal text-foreground"
            />
          </label>
          <div className="rounded-md border bg-background px-3 py-2 flex items-center justify-between">
            <span className="text-xs uppercase text-muted-foreground font-semibold">Computed Window</span>
            <span className="text-sm font-bold">{periodDays} day{periodDays === 1 ? '' : 's'}</span>
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-muted-foreground">
            Currency
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value as SupportedCurrency)}
              className="h-10 rounded-md border bg-background px-3 text-sm font-normal text-foreground"
            >
              <option value="GHS">Cedis (GH₵)</option>
              <option value="USD">Dollar ($)</option>
              <option value="EUR">Euro (€)</option>
              <option value="GBP">Pounds (£)</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Yield Score</p>
          <p className="text-2xl font-black">{summary?.cropHealthAndYield?.estimatedYieldScore ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Water (L)</p>
          <p className="text-2xl font-black">{summary?.waterAndEnergyUsage?.waterLiters ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Energy (kWh)</p>
          <p className="text-2xl font-black">{summary?.waterAndEnergyUsage?.energyKwh ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Labor Cost</p>
          <p className="text-2xl font-black">{formatMoney(summary?.laborCostAndProductivity?.totalLaborCost)}</p>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-2">
        <h2 className="text-sm font-bold uppercase">Detailed Summary</h2>
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          <div className="rounded-md bg-accent/20 p-3">Avg moisture: <span className="font-semibold">{summary?.cropHealthAndYield?.averageMoisture ?? 0}</span></div>
          <div className="rounded-md bg-accent/20 p-3">Avg temperature: <span className="font-semibold">{summary?.cropHealthAndYield?.averageTemperature ?? 0}</span></div>
          <div className="rounded-md bg-accent/20 p-3">Critical alerts: <span className="font-semibold">{summary?.equipmentMaintenanceAndPerformance?.criticalAlerts ?? 0}</span></div>
          <div className="rounded-md bg-accent/20 p-3">Completed tasks: <span className="font-semibold">{summary?.laborCostAndProductivity?.completedTasks ?? 0}</span></div>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Export</h2>
        <p className="text-xs text-muted-foreground">Exports use the selected date range.</p>
        <div className="grid gap-2 md:grid-cols-3">
          <button onClick={() => void download('csv')} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Export CSV</button>
          <button onClick={() => void download('excel')} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Export Excel</button>
          <button onClick={() => void download('pdf')} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Export PDF</button>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Transaction Report</h2>
        <p className="text-xs text-muted-foreground">Record report on every transaction in the selected range.</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="p-3 rounded-lg border bg-background">
            <p className="text-[10px] uppercase text-muted-foreground">Total Transactions</p>
            <p className="text-xl font-black">{transactionReport?.totals?.totalTransactions ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg border bg-background">
            <p className="text-[10px] uppercase text-muted-foreground">Pending</p>
            <p className="text-xl font-black">{transactionReport?.totals?.pendingTransactions ?? 0}</p>
          </div>
          <div className="p-3 rounded-lg border bg-background">
            <p className="text-[10px] uppercase text-muted-foreground">Approved Amount</p>
            <p className="text-xl font-black">{formatMoney(transactionReport?.totals?.approvedAmount)}</p>
          </div>
          <div className="p-3 rounded-lg border bg-background">
            <p className="text-[10px] uppercase text-muted-foreground">Rejected Amount</p>
            <p className="text-xl font-black">{formatMoney(transactionReport?.totals?.rejectedAmount)}</p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <button onClick={() => void downloadTransactions('csv')} className="h-10 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold">Export Transaction CSV</button>
          <button onClick={() => void downloadTransactions('excel')} className="h-10 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold">Export Transaction Excel</button>
          <button onClick={() => void downloadTransactions('pdf')} className="h-10 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold">Export Transaction PDF</button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-accent/30">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] uppercase">Request</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase">Requested At</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase">Category</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase">Amount</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase">Status</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase">Decision Note</th>
              </tr>
            </thead>
            <tbody>
              {(transactionReport?.records?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No transaction records available for this period.</td>
                </tr>
              ) : (
                transactionReport?.records.map((record) => (
                  <tr key={record.requestId} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{record.requestId.slice(0, 12)}</td>
                    <td className="px-3 py-2">{new Date(record.requestedAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{record.category}</td>
                    <td className="px-3 py-2">{formatMoney(record.amount)}</td>
                    <td className="px-3 py-2">{record.status}</td>
                    <td className="px-3 py-2">{record.comment || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-4">
        <h2 className="text-sm font-bold uppercase">Operations Detailed Reports</h2>
        <p className="text-xs text-muted-foreground">Click a block to see detailed activity logs with timestamps.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {operationsBlocks.map((block) => {
            const isActive = selectedOperationsDomain === block.key;
            return (
              <button
                key={block.key}
                type="button"
                onClick={() => setSelectedOperationsDomain(block.key)}
                className={`rounded-lg border bg-background p-3 space-y-2 text-left transition ${isActive ? 'ring-2 ring-primary border-primary/60' : 'hover:border-primary/40'}`}
              >
                <h3 className="text-xs font-bold uppercase">{block.title}</h3>
                {block.stats.map((stat) => (
                  <p key={stat} className="text-sm">
                    <span className="font-semibold">{stat}</span>
                  </p>
                ))}
                <ul className="text-xs text-muted-foreground space-y-1">
                  {block.recent.slice(0, 2).map((item) => <li key={item.id}>{item.note}</li>)}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border bg-background p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase">{selectedOperationsBlock?.title || 'Activity Log'}</h3>
            <span className="text-[11px] uppercase text-muted-foreground">Timestamped Activity</span>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-accent/30">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] uppercase">Timestamp</th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase">Action</th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase">Detail</th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase">Log ID</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOperationsBlock?.recent.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No activity logs available for this block in selected range.</td>
                  </tr>
                ) : (
                  selectedOperationsBlock?.recent.map((record) => (
                    <tr key={record.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(record.when).toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold">{record.action}</td>
                      <td className="px-3 py-2">{record.note}</td>
                      <td className="px-3 py-2 font-mono text-xs">{record.id.slice(0, 12)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
