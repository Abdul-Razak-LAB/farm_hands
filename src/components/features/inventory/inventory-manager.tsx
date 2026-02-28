'use client';

import { useState } from 'react';
import { CubeIcon, ArrowUpRightIcon, ArrowDownLeftIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export function InventoryManager() {
    const [items] = useState([
        { id: '1', name: 'Premium Cattle Feed', category: 'FEED', stock: 450, unit: 'KG', min: 100 },
        { id: '2', name: 'Nitrogen Fertilizer', category: 'CHEMICALS', stock: 12, unit: 'L', min: 50 },
        { id: '3', name: 'Irrigation Valves', category: 'EQUIPMENT', stock: 24, unit: 'PCS', min: 10 },
    ]);

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-2xl font-bold">Inventory</h1>

            <div className="grid gap-3">
                {items.map((item) => (
                    <div key={item.id} className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center",
                                    item.category === 'FEED' ? "bg-amber-100 text-amber-600" :
                                        item.category === 'CHEMICALS' ? "bg-purple-100 text-purple-600" :
                                            "bg-blue-100 text-blue-600"
                                )}>
                                    {item.category === 'FEED' ? <CubeIcon className="h-6 w-6" /> :
                                        item.category === 'CHEMICALS' ? <BeakerIcon className="h-6 w-6" /> :
                                            <CubeIcon className="h-6 w-6" />}
                                </div>
                                <div>
                                    <h3 className="font-bold">{item.name}</h3>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{item.category}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={cn(
                                    "text-xl font-black",
                                    item.stock < item.min ? "text-destructive" : "text-primary"
                                )}>
                                    {item.stock} {item.unit}
                                </p>
                                {item.stock < item.min && (
                                    <p className="text-[10px] text-destructive uppercase font-bold">Low Stock</p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t">
                            <button className="flex-1 py-2 bg-accent hover:bg-accent/80 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                                <ArrowDownLeftIcon className="h-4 w-4" />
                                Stock In
                            </button>
                            <button className="flex-1 py-2 bg-accent hover:bg-accent/80 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                                <ArrowUpRightIcon className="h-4 w-4" />
                                Stock Out
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
