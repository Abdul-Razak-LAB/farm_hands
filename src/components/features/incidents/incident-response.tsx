'use client';

import { useState } from 'react';
import {
    ExclamationCircleIcon,
    ChatBubbleBottomCenterTextIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export function IncidentResponse() {
    const [incidents] = useState([
        { id: '1', title: 'Fence Breach - Sector 9', severity: 'HIGH', status: 'OPEN', reportedAt: '1h ago' },
        { id: '2', title: 'Irrigation Pump Failure', severity: 'URGENT', status: 'IN_PROGRESS', reportedAt: '15m ago' },
    ]);

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-2xl font-bold">Incidents</h1>

            <div className="grid gap-4">
                {incidents.map((incident) => (
                    <div key={incident.id} className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center",
                                    incident.severity === 'URGENT' ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                                )}>
                                    <ExclamationCircleIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold">{incident.title}</h3>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Reported {incident.reportedAt}</p>
                                </div>
                            </div>
                            <div className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                incident.status === 'OPEN' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                            )}>
                                {incident.status}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button className="flex-1 py-3 bg-accent rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
                                Coordination
                            </button>
                            <button className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                <ShieldCheckIcon className="h-4 w-4" />
                                Resolve
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
