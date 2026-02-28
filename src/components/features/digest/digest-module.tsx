'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { useQuery } from '@tanstack/react-query';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

async function apiCall<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const json = (await response.json()) as ApiEnvelope<T>;
  if (!json.success) {
    throw new Error(json.error?.message || 'Request failed');
  }
  return json.data as T;
}

export function DigestModule() {
  const { farmId } = useAuth();
  const digestQuery = useQuery({
    queryKey: ['weekly-digest', farmId],
    queryFn: () => apiCall<any>(`/api/farms/${farmId}/weekly-digest`),
    enabled: Boolean(farmId),
  });

  const digest = digestQuery.data;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Weekly Digest</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Owner exception center</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Events</p>
          <p className="text-2xl font-black">{digest?.totals?.events ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Open Alerts</p>
          <p className="text-2xl font-black">{digest?.totals?.unresolvedAlerts ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Open POs</p>
          <p className="text-2xl font-black">{digest?.totals?.openPurchaseOrders ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Pending Payroll</p>
          <p className="text-2xl font-black">{digest?.totals?.pendingPayrollRuns ?? 0}</p>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card">
        <h2 className="text-sm font-bold uppercase mb-3">Event Trends</h2>
        <div className="space-y-2">
          {digest?.byType ? Object.entries(digest.byType).map(([type, count]) => (
            <div key={type} className="flex justify-between text-sm bg-accent/20 rounded-md px-3 py-2">
              <span className="font-medium">{type}</span>
              <span className="font-bold">{String(count)}</span>
            </div>
          )) : <p className="text-xs text-muted-foreground">No trend data yet.</p>}
        </div>
      </section>
    </div>
  );
}
