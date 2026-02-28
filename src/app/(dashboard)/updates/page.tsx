'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { formatDate } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useOfflineAction } from '@/hooks/use-offline-sync';
import { useWebPush } from '@/hooks/use-web-push';

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

export default function UpdatesPage() {
  const { farmId } = useAuth();
  const { mutateAsync: queueDailyUpdate } = useOfflineAction('updates', 'DAILY_UPDATE_SUBMITTED');
  const push = useWebPush();
  const [inputMode, setInputMode] = useState<'VOICE' | 'FORM'>('VOICE');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [blockers, setBlockers] = useState('');

  const updatesQuery = useQuery({
    queryKey: ['daily-updates', farmId],
    queryFn: () => apiCall<any[]>(`/api/farms/${farmId}/daily-updates`),
    enabled: Boolean(farmId),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        summary: inputMode === 'VOICE' ? voiceTranscript || summary : summary,
        blockers: blockers || undefined,
        inputMode,
        idempotencyKey: crypto.randomUUID(),
      };

      if (typeof window !== 'undefined' && !window.navigator.onLine) {
        await queueDailyUpdate({
          ...payload,
          queuedAt: new Date().toISOString(),
          offline: true,
        });
        return { queued: true };
      }

      try {
        return await apiCall(`/api/farms/${farmId}/daily-updates`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        await queueDailyUpdate({
          ...payload,
          queuedAt: new Date().toISOString(),
          offline: true,
        });
        return { queued: true };
      }
    },
    onSuccess: () => {
      setSummary('');
      setBlockers('');
      setVoiceTranscript('');
      setIsRecording(false);
      void updatesQuery.refetch();
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Daily Update</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Voice-first fallback to short-form</p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <div className="rounded-md border bg-accent/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase">Alerts</p>
            <button
              onClick={() => push.subscribe(farmId ?? undefined)}
              disabled={push.isSubscribing || !push.isSupported || !push.integrationAvailable || push.isSubscribed}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              {push.isSubscribed ? 'Enabled' : push.isSubscribing ? 'Enabling...' : 'Enable Push'}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {push.message || 'Enable notifications for escalations. If unavailable, in-app alerts remain active.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-accent/30 p-1">
          <button
            onClick={() => setInputMode('VOICE')}
            className={`h-9 rounded-md text-xs font-semibold ${inputMode === 'VOICE' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Voice First
          </button>
          <button
            onClick={() => setInputMode('FORM')}
            className={`h-9 rounded-md text-xs font-semibold ${inputMode === 'FORM' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Short Form
          </button>
        </div>

        {inputMode === 'VOICE' ? (
          <div className="space-y-2">
            <button
              onClick={() => setIsRecording((current) => !current)}
              className={`w-full h-10 rounded-md text-sm font-semibold ${isRecording ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            <textarea
              value={voiceTranscript}
              onChange={(event) => setVoiceTranscript(event.target.value)}
              placeholder="Voice transcript will appear here (editable fallback)"
              className="w-full min-h-[100px] rounded-md bg-accent/40 px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What was completed today?"
            className="w-full min-h-[100px] rounded-md bg-accent/40 px-3 py-2 text-sm"
          />
        )}
        <input
          value={blockers}
          onChange={(event) => setBlockers(event.target.value)}
          placeholder="Blockers (optional)"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || ((inputMode === 'VOICE' ? voiceTranscript : summary).trim().length < 3)}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {createMutation.isPending ? 'Saving...' : 'Submit Update'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card">
        <h2 className="text-sm font-bold uppercase mb-3">Recent Updates</h2>
        <div className="space-y-2">
          {updatesQuery.data?.length ? updatesQuery.data.map((entry: any) => (
            <div key={entry.id} className="p-3 rounded-md bg-accent/20">
              <p className="text-sm">{entry.payload?.summary}</p>
              {entry.payload?.blockers ? <p className="text-xs text-muted-foreground mt-1">Blockers: {entry.payload.blockers}</p> : null}
              <p className="text-[11px] text-muted-foreground mt-2">{formatDate(entry.createdAt)}</p>
            </div>
          )) : <p className="text-xs text-muted-foreground">No updates submitted yet.</p>}
        </div>
      </section>
    </div>
  );
}
