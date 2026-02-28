'use client';

import { useState } from 'react';
import { ClipboardDocumentCheckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export function VerificationChecklist() {
    const [items, setItems] = useState([
        { id: '1', label: 'Inspect perimeter fence for breaches', checked: true },
        { id: '2', label: 'Verify livestock tag counts in Sect 4', checked: false },
        { id: '3', label: 'Check sensor battery levels', checked: false },
        { id: '4', label: 'Validate feed storage temperature', checked: false },
    ]);

    const toggle = (id: string) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Audit Executive</h1>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Weekly Audit
                </span>
            </div>

            <div className="bg-card border rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-4 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    <div className="flex-1 h-1 bg-accent rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(items.filter(i => i.checked).length / items.length) * 100}%` }}
                        />
                    </div>
                    <span>{items.filter(i => i.checked).length}/{items.length} Tasks</span>
                </div>

                <div className="space-y-2">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => toggle(item.id)}
                            className={cn(
                                "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                                item.checked ? "bg-primary/5 border-primary/20" : "bg-background"
                            )}
                        >
                            <div className={cn(
                                "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                                item.checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                            )}>
                                {item.checked && <CheckCircleIcon className="h-5 w-5" />}
                            </div>
                            <span className={cn(
                                "font-medium pt-0.5",
                                item.checked && "text-muted-foreground line-through"
                            )}>{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <button
                disabled={items.some(i => !i.checked)}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-lg shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
            >
                Finalize & Upload Audit
            </button>
        </div>
    );
}
