'use client';

import { useState } from 'react';
import { ShoppingCartIcon, PlusIcon, InboxIcon, TruckIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export function ProcurementDashboard() {
    const [activeTab, setActiveTab] = useState<'REQUESTS' | 'ORDERS'>('REQUESTS');

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Procurement</h1>
                <button className="h-10 w-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <PlusIcon className="h-6 w-6" />
                </button>
            </div>

            <div className="flex bg-accent/50 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('REQUESTS')}
                    className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'REQUESTS' ? "bg-background shadow-sm" : "text-muted-foreground"
                    )}
                >
                    Requests
                </button>
                <button
                    onClick={() => setActiveTab('ORDERS')}
                    className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'ORDERS' ? "bg-background shadow-sm" : "text-muted-foreground"
                    )}
                >
                    Purchase Orders
                </button>
            </div>

            <div className="grid gap-4">
                {activeTab === 'REQUESTS' ? (
                    <>
                        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                    <InboxIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold">50x Irrigation Pipes</h3>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Manager Requested • Feb 18</p>
                                </div>
                            </div>
                            <div className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Pending</div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-card border rounded-2xl p-4 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                    <TruckIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold">PO #2026-081</h3>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">AgroSupply Ltd • $4,200</p>
                                </div>
                            </div>
                            <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Dispatched</div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
