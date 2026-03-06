'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { getFarmData } from '@/lib/api/farm-client';
import type { ReportSummary } from '@/lib/api/contracts';

export function ReportsModule() {
  const { farmId } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ['farm-reports', farmId],
    queryFn: () => getFarmData<ReportSummary>(farmId!, '/reports?format=json&periodDays=30'),
    enabled: Boolean(farmId),
  });

  const summary = summaryQuery.data;

  const download = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!farmId) return;
    const response = await fetch(`/api/farms/${farmId}/reports?format=${format}&periodDays=30`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `farm-report-${farmId}.${format === 'excel' ? 'xls' : format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Reporting & Analytics</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Farm performance insights and exports</p>
      </header>

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
          <p className="text-2xl font-black">{summary?.laborCostAndProductivity?.totalLaborCost ?? 0}</p>
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
        <div className="grid gap-2 md:grid-cols-3">
          <button onClick={() => void download('csv')} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Export CSV</button>
          <button onClick={() => void download('excel')} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Export Excel</button>
          <button onClick={() => void download('pdf')} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Export PDF</button>
        </div>
      </section>
    </div>
  );
}
