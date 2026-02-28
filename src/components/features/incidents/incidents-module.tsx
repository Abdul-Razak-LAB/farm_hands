'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { formatDate } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

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

export function IncidentsModule() {
  const { farmId } = useAuth();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [issueEventId, setIssueEventId] = useState('');
  const [resolution, setResolution] = useState('');

  const timelineQuery = useQuery({
    queryKey: ['incident-timeline', farmId],
    queryFn: () => apiCall<any[]>(`/api/farms/${farmId}/incidents`),
    enabled: Boolean(farmId),
  });

  const reportMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/incidents`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        details: details || undefined,
        severity,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setTitle('');
      setDetails('');
      void timelineQuery.refetch();
    },
  });

  const expertMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/incidents/expert-request`, {
      method: 'POST',
      body: JSON.stringify({
        issueEventId,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      void timelineQuery.refetch();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/incidents/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        issueEventId,
        resolution,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setResolution('');
      void timelineQuery.refetch();
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Escalation, expert support, resolution tracking</p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-2">
        <h2 className="text-sm font-bold uppercase">Report Issue</h2>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Issue title"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')}
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        >
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Details"
          className="w-full min-h-[80px] rounded-md bg-accent/40 px-3 py-2 text-sm"
        />
        <button
          onClick={() => reportMutation.mutate()}
          disabled={reportMutation.isPending || title.trim().length < 3}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {reportMutation.isPending ? 'Reporting...' : 'Report Incident'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-2">
        <h2 className="text-sm font-bold uppercase">Issue Action</h2>
        <input
          value={issueEventId}
          onChange={(event) => setIssueEventId(event.target.value)}
          placeholder="Issue Event ID"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <input
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          placeholder="Resolution note"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => expertMutation.mutate()}
            disabled={expertMutation.isPending || !issueEventId}
            className="h-10 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold disabled:opacity-50"
          >
            Request Expert
          </button>
          <button
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending || !issueEventId || resolution.trim().length < 3}
            className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            Resolve
          </button>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card">
        <h2 className="text-sm font-bold uppercase mb-2">Issue Timeline</h2>
        <div className="space-y-2">
          {timelineQuery.data?.length ? timelineQuery.data.map((event: any) => (
            <div key={event.id} className="p-3 rounded-md bg-accent/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">{event.type}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(event.createdAt)}</p>
              </div>
              <p className="text-[11px] mt-1 text-muted-foreground">{JSON.stringify(event.payload)}</p>
            </div>
          )) : <p className="text-xs text-muted-foreground">No incident events yet.</p>}
        </div>
      </section>
    </div>
  );
}
