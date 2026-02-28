'use client';

import { useState } from 'react';
import {
    BellAlertIcon,
    BoltIcon,
    BeakerIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export function MonitoringDashboard() {
    const [sensors] = useState([
        { id: '1', name: 'Soil Moisture - Plot A', value: '34%', status: 'HEALTHY', type: 'MOISTURE' },
        { id: '2', name: 'Water Tank Level', value: '12%', status: 'CRITICAL', type: 'LEVEL' },
        { id: '3', name: 'Power Grid - North', value: 'OK', status: 'HEALTHY', type: 'POWER' },
    ]);

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-2xl font-bold">Monitoring</h1>

            <div className="grid grid-cols-2 gap-4">
                {sensors.map((sensor) => (
                    <div key={sensor.id} className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
                        <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center",
                            sensor.status === 'CRITICAL' ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
                        )}>
                            {sensor.type === 'MOISTURE' ? <BeakerIcon className="h-6 w-6" /> :
                                sensor.type === 'LEVEL' ? <ExclamationTriangleIcon className="h-6 w-6" /> :
                                    <BoltIcon className="h-6 w-6" />}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase">{sensor.name}</p>
                            <p className="text-2xl font-black">{sensor.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Active Alerts</h3>
                <div className="bg-destructive/5 border-2 border-destructive/20 rounded-2xl p-4 flex gap-4">
                    <BellAlertIcon className="h-10 w-10 text-destructive shrink-0" />
                    <div>
                        <p className="font-bold text-destructive">Critical: Water Shortage</p>
                        <p className="text-sm text-destructive/80">Tank 2 level dropped below 15%. Automatic irrigation paused.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
