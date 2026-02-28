"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/layout/auth-provider';

type Role = 'OWNER' | 'MANAGER' | 'WORKER';

type PendingInvite = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
};

export default function HomePage() {
  const { role, farmId } = useAuth();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('WORKER');
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteError, setInviteError] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  const modules: Array<{ name: string; href: string; roles: Role[]; description: string }> = [
    { name: 'Tasks', href: '/tasks', roles: ['MANAGER', 'WORKER'], description: 'Today, overdue, completed, and proof capture.' },
    { name: 'Finance', href: '/finance', roles: ['OWNER', 'MANAGER'], description: 'Spend requests, approvals, and budget visibility.' },
    { name: 'Procurement', href: '/procurement', roles: ['OWNER', 'MANAGER'], description: 'Requests, purchase orders, and delivery checks.' },
    { name: 'Payroll', href: '/payroll', roles: ['OWNER', 'MANAGER'], description: 'Run preparation, approvals, and payout status.' },
    { name: 'Monitoring', href: '/monitoring', roles: ['OWNER', 'MANAGER'], description: 'Sensor state, alerts, and issue timeline.' },
    { name: 'Offline Center', href: '/offline', roles: ['OWNER', 'MANAGER', 'WORKER'], description: 'Queue visibility, retries, and manual sync.' },
  ];

  const effectiveRole: Role = (role as Role | null) || 'WORKER';
  const availableModules = modules.filter((module) => module.roles.includes(effectiveRole));
  const canManageInvites = effectiveRole === 'OWNER' || effectiveRole === 'MANAGER';

  const inviteHeaders = useMemo(() => {
    return {
      'Content-Type': 'application/json',
      ...(role ? { 'x-farm-role': role } : {}),
      ...(farmId ? { 'x-user-id': `farm-user-${farmId.slice(0, 8)}` } : {}),
    };
  }, [farmId, role]);

  const loadInvites = async () => {
    if (!canManageInvites || !farmId) {
      setPendingInvites([]);
      return;
    }

    const response = await fetch(`/api/farms/${farmId}/invites`, {
      headers: inviteHeaders,
      cache: 'no-store',
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to load invites.');
    }

    setPendingInvites(result.data as PendingInvite[]);
  };

  useEffect(() => {
    void loadInvites();
  }, [farmId, canManageInvites, inviteHeaders]);

  const submitInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteError('');
    setInviteMessage('');

    if (!farmId) {
      setInviteError('Select a farm first before sending invites.');
      return;
    }

    if (!inviteEmail.trim()) {
      setInviteError('Invite email is required.');
      return;
    }

    try {
      setIsInviting(true);
      const response = await fetch(`/api/farms/${farmId}/invites`, {
        method: 'POST',
        headers: inviteHeaders,
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to send invite.');
      }

      setInviteMessage(`Invite sent to ${result.data.email}.`);
      setInviteEmail('');
      await loadInvites();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to send invite.');
    } finally {
      setIsInviting(false);
    }
  };

  const resendInvite = async (inviteId: string) => {
    if (!farmId) return;

    setInviteError('');
    setInviteMessage('');

    try {
      setResendingInviteId(inviteId);
      const response = await fetch(`/api/farms/${farmId}/invites/${inviteId}/resend`, {
        method: 'POST',
        headers: inviteHeaders,
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to resend invite.');
      }

      setInviteMessage(`Invite resent to ${result.data.email}.`);
      await loadInvites();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to resend invite.');
    } finally {
      setResendingInviteId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10 space-y-8">
      <section className="rounded-3xl border bg-card p-5 md:p-8">
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <p className="text-lg font-extrabold tracking-tight">FarmOSP</p>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
            <span>Features</span>
            <span>Modules</span>
            <span>Offline</span>
            <span>Support</span>
          </div>
          <Link href="/register" className="h-10 inline-flex items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Get Started
          </Link>
        </div>

        <div className="mx-auto max-w-4xl py-10 md:py-16 text-center space-y-5">
          <p className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Built for Modern Farm Teams
          </p>

          <h1 className="text-4xl font-black tracking-tight md:text-7xl leading-[0.95]">
            Farm operations,
            <br />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--foreground)))' }}
            >
              Smarter & Faster
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-2xl">
            Manage tasks, inventory, procurement, payroll, and verification from your phone—online or offline.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={availableModules[0]?.href || '/offline'}
              className="h-11 inline-flex items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Open Workspace
            </Link>
            <Link
              href="/offline"
              className="h-11 inline-flex items-center justify-center rounded-md border bg-background px-5 text-sm font-semibold"
            >
              View Offline Center
            </Link>
          </div>

          <div className="mx-auto grid w-full max-w-3xl gap-2 pt-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-background px-3 py-2 text-left">
              <p className="text-[11px] text-muted-foreground uppercase">Active Farm</p>
              <p className="text-sm font-semibold">{farmId || 'Not selected'}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2 text-left">
              <p className="text-[11px] text-muted-foreground uppercase">Role</p>
              <p className="text-sm font-semibold">{role || 'WORKER'}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2 text-left">
              <p className="text-[11px] text-muted-foreground uppercase">Sync</p>
              <p className="text-sm font-semibold">Foreground + Retry</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Quick Access</h2>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Role-aware modules</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {availableModules.map((module) => (
            <Link
              key={module.name}
              href={module.href}
              className="group rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <p className="text-sm font-semibold">{module.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{module.description}</p>
              <p className="mt-3 text-xs font-semibold text-primary">Open module →</p>
            </Link>
          ))}
        </div>
      </section>

      {canManageInvites ? (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Team Invites</h2>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Owner/Manager</span>
          </div>

          <form className="grid gap-2 md:grid-cols-[1fr_160px_auto]" onSubmit={submitInvite}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="worker@farm.com"
              className="h-10 rounded-md border bg-background px-3 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as Role)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="WORKER">WORKER</option>
              <option value="MANAGER">MANAGER</option>
              <option value="OWNER">OWNER</option>
            </select>
            <button
              type="submit"
              disabled={isInviting}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {isInviting ? 'Sending...' : 'Send invite'}
            </button>
          </form>

          {inviteError ? <p className="text-xs text-destructive">{inviteError}</p> : null}
          {inviteMessage ? <p className="text-xs text-primary">{inviteMessage}</p> : null}

          <div className="space-y-2">
            {pendingInvites.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending invites.</p>
            ) : (
              pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">{invite.role} · Expires {new Date(invite.expiresAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void resendInvite(invite.id)}
                    disabled={resendingInviteId === invite.id}
                    className="h-8 rounded-md border px-3 text-xs font-semibold disabled:opacity-60"
                  >
                    {resendingInviteId === invite.id ? 'Resending...' : 'Resend'}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Offline-first</h3>
          <p className="mt-1 text-xs text-muted-foreground">Actions save locally first and sync safely when connectivity returns.</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Proof-ready workflows</h3>
          <p className="mt-1 text-xs text-muted-foreground">Photo, video, voice, and metadata capture support field accountability.</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Role-governed operations</h3>
          <p className="mt-1 text-xs text-muted-foreground">Access controls keep each role focused on authorized responsibilities.</p>
        </div>
      </section>
    </div>
  );
}
