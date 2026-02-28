'use client';

import { InventoryMovementForm } from '@/components/features/inventory/inventory-movement-form';
import { useMemo, useState } from 'react';
import { ArchiveBoxIcon, BeakerIcon, ScaleIcon } from '@heroicons/react/24/outline';

export default function InventoryDashboard() {
  const [leakageItem, setLeakageItem] = useState('');
  const [leakageQty, setLeakageQty] = useState(0);
  const [leakageReason, setLeakageReason] = useState('');
  const [leakageLog, setLeakageLog] = useState<Array<{ id: string; item: string; qty: number; reason: string; loggedAt: string }>>([]);

  // Mock data for current stock levels
  const stocks = [
    { name: 'NPK 15-15-15', qty: 24, unit: 'Bags', trend: 'down', icon: ArchiveBoxIcon },
    { name: 'Glyphosate', qty: 120, unit: 'Litres', trend: 'up', icon: BeakerIcon },
    { name: 'Corn Seeds', qty: 8, unit: 'Sacks', trend: 'stable', icon: ScaleIcon },
  ];

  const lots = useMemo(() => [
    { lot: 'NPK-2026-FEB-001', item: 'NPK 15-15-15', expiry: '2026-08-10', qty: 24 },
    { lot: 'GLY-EXP-2027', item: 'Glyphosate', expiry: '2027-05-01', qty: 120 },
    { lot: 'SEED-CORN-LOT9', item: 'Corn Seeds', expiry: '2026-09-12', qty: 8 },
  ], []);

  const submitLeakage = () => {
    if (!leakageItem || leakageQty <= 0 || leakageReason.trim().length < 3) return;
    setLeakageLog((current) => [
      {
        id: crypto.randomUUID(),
        item: leakageItem,
        qty: leakageQty,
        reason: leakageReason,
        loggedAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setLeakageItem('');
    setLeakageQty(0);
    setLeakageReason('');
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-8 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Real-time stock control</p>
      </header>

      {/* Stock Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stocks.map((s) => (
          <div key={s.name} className="p-4 bg-card border rounded-2xl shadow-sm space-y-2">
            <s.icon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground truncate uppercase">{s.name}</p>
              <p className="text-xl font-black">{s.qty} <span className="text-[10px] text-muted-foreground">{s.unit}</span></p>
            </div>
            <div className="h-1 w-full rounded-full bg-accent overflow-hidden">
              <div className={`h-full w-2/3 ${s.trend === 'down' ? 'bg-muted-foreground' : 'bg-primary'}`} />
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Log Movement</h2>
        <InventoryMovementForm />
      </section>

      <section className="bg-accent/30 p-4 rounded-2xl border border-dashed">
        <h3 className="text-[10px] font-bold uppercase mb-2">Lot Tracking</h3>
        <ul className="space-y-2">
          {lots.map((lot) => (
            <li key={lot.lot} className="rounded-md bg-background/80 px-3 py-2 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold">{lot.lot}</span>
                <span className="text-muted-foreground">{lot.qty} units</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{lot.item} · Exp {lot.expiry}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h3 className="text-sm font-bold uppercase">Leakage-item Controls</h3>
        <select
          value={leakageItem}
          onChange={(event) => setLeakageItem(event.target.value)}
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        >
          <option value="">Select item</option>
          {stocks.map((item) => (
            <option key={item.name} value={item.name}>{item.name}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={leakageQty}
          onChange={(event) => setLeakageQty(Number(event.target.value))}
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          placeholder="Leakage quantity"
        />
        <input
          value={leakageReason}
          onChange={(event) => setLeakageReason(event.target.value)}
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          placeholder="Reason (spillage, moisture damage, theft...)"
        />
        <button
          onClick={submitLeakage}
          disabled={!leakageItem || leakageQty <= 0 || leakageReason.trim().length < 3}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          Log Leakage
        </button>

        <div className="space-y-2">
          {leakageLog.length ? leakageLog.map((entry) => (
            <div key={entry.id} className="p-2 rounded-md bg-accent/20 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold">{entry.item}</span>
                <span className="text-muted-foreground">-{entry.qty}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{entry.reason}</p>
            </div>
          )) : <p className="text-xs text-muted-foreground">No leakage entries logged.</p>}
        </div>
      </section>
    </div>
  );
}
