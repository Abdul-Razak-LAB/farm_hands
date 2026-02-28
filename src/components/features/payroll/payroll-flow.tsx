'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CreditCardIcon, UsersIcon, CalendarIcon } from '@heroicons/react/24/outline';

export function PayrollFlow() {
    const [workers] = useState([
        { id: '1', name: 'James Wilson', role: 'HEAD_WORKER', hours: 45, rate: 18, total: 810 },
        { id: '2', name: 'Maria Garcia', role: 'WORKER', hours: 40, rate: 15, total: 600 },
        { id: '3', name: 'Robert Chen', role: 'WORKER', hours: 38, rate: 15, total: 570 },
    ]);

    return (
        <div className="p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Payroll Preparation</h1>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Weekly Run
                </div>
            </div>

            <div className="bg-card border rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-3 text-sm font-medium">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                    <span>Feb 12 - Feb 19, 2026</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium">
                    <UsersIcon className="h-5 w-5 text-muted-foreground" />
                    <span>3 Workers Active</span>
                </div>
                <div className="pt-4 border-t flex justify-between items-end">
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-tighter">Total Payout</p>
                    <p className="text-3xl font-black text-primary">$1,980.00</p>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground px-1">Worker Breakdown</h3>
                <div className="grid gap-3">
                    {workers.map((worker) => (
                        <div key={worker.id} className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
                            <div>
                                <p className="font-bold">{worker.name}</p>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">{worker.role} • {worker.hours}h @ ${worker.rate}/h</p>
                            </div>
                            <p className="font-black text-lg">${worker.total}</p>
                        </div>
                    ))}
                </div>
            </div>

            <button
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-lg shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
                <CreditCardIcon className="h-6 w-6" />
                Process Payroll Run
            </button>
        </div>
    );
}
