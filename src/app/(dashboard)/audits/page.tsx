'use client';

import { useState } from 'react';
import { VerificationAudit } from '@/components/features/verification/audit-form';
import { ShieldCheckIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function AuditsPage() {
  const [scheduleName, setScheduleName] = useState('Post-Harvest Reconciliation');
  const [scheduleDate, setScheduleDate] = useState('');
  const [discrepancies, setDiscrepancies] = useState<Array<{ id: string; title: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' }>>([
    { id: 'd1', title: 'Missing weighbridge evidence on batch NPK-2026-FEB-001', severity: 'MEDIUM' },
    { id: 'd2', title: 'Unverified pesticide withdrawal log entry', severity: 'HIGH' },
  ]);

  const addScheduleDiscrepancy = () => {
    if (!scheduleName.trim() || !scheduleDate) return;
    setDiscrepancies((current) => [
      {
        id: crypto.randomUUID(),
        title: `Scheduled audit '${scheduleName}' for ${scheduleDate}`,
        severity: 'LOW',
      },
      ...current,
    ]);
    setScheduleDate('');
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-8 pb-24 md:pb-8">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tighter">Verification</h1>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-none">Trust Architecture</p>
        </div>
        <div className="flex flex-col items-end">
          <ShieldCheckIcon className="h-8 w-8 text-primary opacity-30" />
          <span className="text-[8px] font-bold mt-1 text-primary">ENCRYPTED LOG</span>
        </div>
      </header>

      <section className="bg-accent/30 p-4 rounded-2xl flex items-center gap-3 border border-border">
        <div className="h-10 w-10 bg-background rounded-full flex items-center justify-center border shadow-sm">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Next Scheduled</p>
          <p className="text-sm font-black">Post-Harvest Reconciliation</p>
          <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">In 4 Days</p>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Audit Scheduling</h2>
        <input
          value={scheduleName}
          onChange={(event) => setScheduleName(event.target.value)}
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
          placeholder="Audit name"
        />
        <input
          type="date"
          value={scheduleDate}
          onChange={(event) => setScheduleDate(event.target.value)}
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <button
          onClick={addScheduleDiscrepancy}
          disabled={!scheduleName.trim() || !scheduleDate}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          Schedule Audit
        </button>
      </section>

      <VerificationAudit />

      <section className="p-4 border rounded-xl bg-card space-y-2">
        <h2 className="text-sm font-bold uppercase">Discrepancy Reports</h2>
        {discrepancies.length ? discrepancies.map((entry) => (
          <div key={entry.id} className="p-3 rounded-md bg-accent/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">{entry.title}</p>
              <span className="text-[10px] uppercase text-muted-foreground">{entry.severity}</span>
            </div>
          </div>
        )) : <p className="text-xs text-muted-foreground">No discrepancies logged.</p>}
      </section>
    </div>
  );
}
