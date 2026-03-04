'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { formatDate } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

type ConsultationUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type ConsultationStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

type ConsultationItem = {
  consultationId: string;
  topic: string;
  question: string;
  urgency: ConsultationUrgency;
  status: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
  assignedExpert?: {
    name?: string;
    email?: string;
  };
  assignedAt?: string;
};

type ConsultationMessage = {
  id: string;
  type: 'REQUEST' | 'MESSAGE' | 'STATUS';
  text: string;
  sender: 'FARMER' | 'EXPERT';
  status?: ConsultationStatus;
  createdAt: string;
};

type ConsultationAnalytics = {
  totalConsultations: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  urgentOpenCount: number;
  averageFirstResponseMinutes: number | null;
};

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
  if (!json.success || !json.data) {
    throw new Error(json.error?.message || 'Request failed');
  }

  return json.data;
}

export function ConsultationModule() {
  const { farmId } = useAuth();
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [urgency, setUrgency] = useState<ConsultationUrgency>('MEDIUM');
  const [selectedConsultationId, setSelectedConsultationId] = useState('');
  const [replyText, setReplyText] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');

  const analyticsQuery = useQuery({
    queryKey: ['consultation-analytics', farmId],
    queryFn: () => apiCall<ConsultationAnalytics>(`/api/farms/${farmId}/consultations/analytics`),
    enabled: Boolean(farmId),
    refetchInterval: 30_000,
  });

  const consultationsQuery = useQuery({
    queryKey: ['consultations', farmId],
    queryFn: () => apiCall<ConsultationItem[]>(`/api/farms/${farmId}/consultations`),
    enabled: Boolean(farmId),
    refetchInterval: 10_000,
  });

  const activeConsultationId = useMemo(() => {
    if (selectedConsultationId) return selectedConsultationId;
    return consultationsQuery.data?.[0]?.consultationId || '';
  }, [consultationsQuery.data, selectedConsultationId]);

  const messagesQuery = useQuery({
    queryKey: ['consultation-messages', farmId, activeConsultationId],
    queryFn: () => apiCall<ConsultationMessage[]>(`/api/farms/${farmId}/consultations/${activeConsultationId}/messages`),
    enabled: Boolean(farmId && activeConsultationId),
    refetchInterval: 5_000,
  });

  const createMutation = useMutation({
    mutationFn: () => apiCall<{ consultationId: string }>(`/api/farms/${farmId}/consultations`, {
      method: 'POST',
      body: JSON.stringify({
        topic,
        question,
        urgency,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: (data) => {
      setTopic('');
      setQuestion('');
      setUrgency('MEDIUM');
      setSelectedConsultationId(data.consultationId);
      void consultationsQuery.refetch();
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: () => apiCall<{ messageEventId?: string }>(`/api/farms/${farmId}/consultations/${activeConsultationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        text: replyText,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setReplyText('');
      void messagesQuery.refetch();
      void consultationsQuery.refetch();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (nextStatus: ConsultationStatus) => apiCall<{ status: ConsultationStatus }>(`/api/farms/${farmId}/consultations/${activeConsultationId}/status`, {
      method: 'POST',
      body: JSON.stringify({
        status: nextStatus,
        note: statusNote || undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setStatusNote('');
      void consultationsQuery.refetch();
      void messagesQuery.refetch();
    },
  });

  const assignMutation = useMutation({
    mutationFn: () => apiCall<{ assigned: boolean }>(`/api/farms/${farmId}/consultations/${activeConsultationId}/assign`, {
      method: 'POST',
      body: JSON.stringify({
        assigneeName: assigneeName || undefined,
        assigneeEmail: assigneeEmail || undefined,
        note: assignmentNote || undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setAssignmentNote('');
      void consultationsQuery.refetch();
      void messagesQuery.refetch();
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Consultation Platform</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Ask experts, track guidance, and resolve farm challenges</p>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Open</p>
          <p className="text-lg font-bold">{analyticsQuery.data?.openCount ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">In Progress</p>
          <p className="text-lg font-bold">{analyticsQuery.data?.inProgressCount ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Resolved</p>
          <p className="text-lg font-bold">{analyticsQuery.data?.resolvedCount ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Urgent Open</p>
          <p className="text-lg font-bold text-destructive">{analyticsQuery.data?.urgentOpenCount ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 sm:col-span-2 xl:col-span-1">
          <p className="text-[10px] uppercase text-muted-foreground">Avg First Response (min)</p>
          <p className="text-lg font-bold">{analyticsQuery.data?.averageFirstResponseMinutes ?? '--'}</p>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Request Consultation</h2>
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Topic (e.g. maize pest outbreak)"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <select
          value={urgency}
          onChange={(event) => setUrgency(event.target.value as ConsultationUrgency)}
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        >
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Describe the problem and the support you need"
          className="w-full min-h-[100px] rounded-md bg-accent/40 px-3 py-2 text-sm"
        />
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || topic.trim().length < 3 || question.trim().length < 5}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {createMutation.isPending ? 'Submitting...' : 'Create Consultation'}
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <h2 className="text-sm font-bold uppercase">Consultation Inbox</h2>
          <div className="space-y-2 max-h-[520px] overflow-auto">
            {consultationsQuery.data?.length ? consultationsQuery.data.map((item) => (
              <button
                key={item.consultationId}
                onClick={() => setSelectedConsultationId(item.consultationId)}
                className={`w-full text-left rounded-md border p-3 ${activeConsultationId === item.consultationId ? 'bg-accent/40 border-primary/30' : 'bg-background'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold truncate">{item.topic}</p>
                  <span className="text-[10px] text-muted-foreground">{item.urgency}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{item.lastMessage || item.question}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{item.status}</span>
                  <span>{item.messageCount} msg</span>
                </div>
                {item.assignedExpert?.name || item.assignedExpert?.email ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Assigned: {item.assignedExpert.name || item.assignedExpert.email}
                  </p>
                ) : null}
              </button>
            )) : <p className="text-xs text-muted-foreground">No consultation requests yet.</p>}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase">Consultation Thread</h2>
          {!activeConsultationId ? (
            <p className="text-sm text-muted-foreground">Select a consultation to view thread.</p>
          ) : (
            <>
              <div className="space-y-2 max-h-[420px] overflow-auto rounded-md border bg-background p-3">
                {messagesQuery.data?.length ? messagesQuery.data.map((message) => (
                  <div key={message.id} className="rounded-md bg-accent/20 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold">{message.sender}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(message.createdAt)}</p>
                    </div>
                    <p className="mt-1 text-sm">{message.text}</p>
                    {message.status ? <p className="text-[10px] mt-1 text-muted-foreground">Status: {message.status}</p> : null}
                  </div>
                )) : <p className="text-xs text-muted-foreground">No thread messages yet.</p>}
              </div>

              <textarea
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Send follow-up note"
                className="w-full min-h-[90px] rounded-md bg-accent/40 px-3 py-2 text-sm"
              />
              <button
                onClick={() => sendReplyMutation.mutate()}
                disabled={sendReplyMutation.isPending || replyText.trim().length < 1}
                className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {sendReplyMutation.isPending ? 'Sending...' : 'Send Reply'}
              </button>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={assigneeName}
                  onChange={(event) => setAssigneeName(event.target.value)}
                  placeholder="Assign expert name"
                  className="h-10 rounded-md bg-accent/40 px-3 text-sm"
                />
                <input
                  value={assigneeEmail}
                  onChange={(event) => setAssigneeEmail(event.target.value)}
                  placeholder="Assign expert email"
                  className="h-10 rounded-md bg-accent/40 px-3 text-sm"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={assignmentNote}
                  onChange={(event) => setAssignmentNote(event.target.value)}
                  placeholder="Assignment note (optional)"
                  className="h-10 rounded-md bg-accent/40 px-3 text-sm"
                />
                <button
                  onClick={() => assignMutation.mutate()}
                  disabled={assignMutation.isPending || (!assigneeName.trim() && !assigneeEmail.trim())}
                  className="h-10 rounded-md border px-3 text-sm font-semibold disabled:opacity-50"
                >
                  {assignMutation.isPending ? 'Assigning...' : 'Assign Expert'}
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  placeholder="Status note (optional)"
                  className="h-10 rounded-md bg-accent/40 px-3 text-sm"
                />
                <button
                  onClick={() => updateStatusMutation.mutate('IN_PROGRESS')}
                  disabled={updateStatusMutation.isPending}
                  className="h-10 rounded-md border px-3 text-sm font-semibold disabled:opacity-50"
                >
                  Mark In Progress
                </button>
                <button
                  onClick={() => updateStatusMutation.mutate('RESOLVED')}
                  disabled={updateStatusMutation.isPending}
                  className="h-10 rounded-md bg-secondary px-3 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
                >
                  Mark Resolved
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
