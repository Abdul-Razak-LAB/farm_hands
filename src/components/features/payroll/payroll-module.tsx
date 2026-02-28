'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatDate } from '@/lib/utils';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const json = (await response.json()) as ApiEnvelope<T>;
  if (!json.success) {
    throw new Error(json.error?.message || 'Request failed');
  }

  return json.data as T;
}

export function PayrollModule() {
  const { farmId } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [grossAmount, setGrossAmount] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [paymentRef, setPaymentRef] = useState('');

  const runsQuery = useQuery({
    queryKey: ['payroll-runs', farmId],
    queryFn: () => apiCall<any[]>(`/api/farms/${farmId}/payroll/runs`),
    enabled: Boolean(farmId),
  });

  const createRunMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/payroll/runs`, {
      method: 'POST',
      body: JSON.stringify({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        idempotencyKey: crypto.randomUUID(),
        entries: [{ userId: workerId, grossAmount, netAmount }],
      }),
    }),
    onSuccess: () => {
      void runsQuery.refetch();
    },
  });

  const approveRunMutation = useMutation({
    mutationFn: (runId: string) => apiCall(`/api/farms/${farmId}/payroll/runs/${runId}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      void runsQuery.refetch();
    },
  });

  const payRunMutation = useMutation({
    mutationFn: (runId: string) => apiCall(`/api/farms/${farmId}/payroll/runs/${runId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        reference: paymentRef || `PAY-${Date.now()}`,
      }),
    }),
    onSuccess: () => {
      void runsQuery.refetch();
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Run prep, approvals, payment status</p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Create Payroll Run</h2>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          />
        </div>
        <input
          value={workerId}
          onChange={(event) => setWorkerId(event.target.value)}
          placeholder="Worker User ID"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={grossAmount}
            onChange={(event) => setGrossAmount(Number(event.target.value))}
            placeholder="Gross"
            className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          />
          <input
            type="number"
            value={netAmount}
            onChange={(event) => setNetAmount(Number(event.target.value))}
            placeholder="Net"
            className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          />
        </div>
        <button
          onClick={() => createRunMutation.mutate()}
          disabled={createRunMutation.isPending || !startDate || !endDate || !workerId || grossAmount <= 0 || netAmount <= 0}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {createRunMutation.isPending ? 'Creating...' : 'Create Run'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Payment Reference</h2>
        <input
          value={paymentRef}
          onChange={(event) => setPaymentRef(event.target.value)}
          placeholder="Optional payment reference"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
      </section>

      <section className="p-4 border rounded-xl bg-card">
        <h2 className="text-sm font-bold uppercase mb-3">Recent Runs</h2>
        <div className="space-y-3">
          {runsQuery.data?.length ? runsQuery.data.map((run: any) => (
            <div key={run.id} className="p-3 rounded-md bg-accent/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{run.id.slice(0, 12)}</span>
                <span className="uppercase text-muted-foreground">{run.status}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {formatDate(run.startDate)} - {formatDate(run.endDate)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => approveRunMutation.mutate(run.id)}
                  disabled={approveRunMutation.isPending || run.status === 'PAID'}
                  className="h-8 px-3 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => payRunMutation.mutate(run.id)}
                  disabled={payRunMutation.isPending || run.status === 'PAID'}
                  className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  Mark Paid
                </button>
              </div>
            </div>
          )) : <p className="text-xs text-muted-foreground">No payroll runs yet.</p>}
        </div>
      </section>
    </div>
  );
}
