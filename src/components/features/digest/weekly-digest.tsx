'use client';

import {
    ChartBarIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CheckBadgeIcon
} from '@heroicons/react/24/outline';

export function WeeklyDigest() {
    return (
        <div className="p-4 space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black">Weekly Digest</h1>
                    <p className="text-muted-foreground text-sm font-medium">Feb 09 - Feb 15, 2026</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 border border-green-200">
                    <CheckBadgeIcon className="h-8 w-8" />
                </div>
            </div>

            <div className="grid gap-4">
                <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <ArrowTrendingUpIcon className="h-5 w-5 text-green-600" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Efficiency Trend</h3>
                    </div>
                    <p className="text-3xl font-black">+12.4% <span className="text-sm font-medium text-muted-foreground">vs last week</span></p>
                    <div className="h-16 w-full flex items-end gap-1">
                        {[40, 60, 45, 90, 80, 70, 95].map((h, i) => (
                            <div key={i} className="flex-1 bg-primary/20 rounded-t-sm" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>

                <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <ArrowTrendingDownIcon className="h-5 w-5 text-destructive" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Spend Variance</h3>
                    </div>
                    <p className="text-3xl font-black">-$2,100 <span className="text-sm font-medium text-muted-foreground">savings achieved</span></p>
                </div>

                <div className="bg-primary text-primary-foreground rounded-2xl p-6 space-y-3 shadow-lg">
                    <h3 className="font-black text-lg">Manager's Insight</h3>
                    <p className="text-sm opacity-90 leading-relaxed italic">
                        "Team performed exceptionally on the North Plot irrigation install. We're 2 days ahead of schedule. Inventory levels for Q2 are secured."
                    </p>
                </div>
            </div>
        </div>
    );
}
