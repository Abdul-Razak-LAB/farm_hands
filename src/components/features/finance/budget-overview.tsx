'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { financeApiCall } from './api';

type BudgetRecord = {
    id: string;
    name: string;
    total: number | string;
    lines: Array<{
        id: string;
        category: string;
        allocated: number | string;
        spent: number | string;
    }>;
};

export function BudgetOverview() {
    const { farmId } = useAuth();
    const budgetsQuery = useQuery({
        queryKey: ['finance-budgets', farmId],
        queryFn: () => financeApiCall<BudgetRecord[]>(`/api/farms/${farmId}/finance/budgets`),
        enabled: Boolean(farmId),
    });

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-2xl font-bold">Budgets</h1>

            <div className="grid gap-4">
                {!farmId ? <p className="text-xs text-muted-foreground">Select a farm to load budget visibility.</p> : null}
                {budgetsQuery.isLoading ? <p className="text-xs text-muted-foreground">Loading budget data...</p> : null}
                {budgetsQuery.data?.length ? budgetsQuery.data.map((budget) => {
                    const allocated = budget.lines.reduce((sum, line) => sum + Number(line.allocated), 0);
                    const spent = budget.lines.reduce((sum, line) => sum + Number(line.spent), 0);
                    const percent = allocated > 0 ? (spent / allocated) * 100 : 0;
                    return (
                        <div key={budget.id} className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold">{budget.name}</h3>
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">{budget.lines.length} categories</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold">${spent.toLocaleString()}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">of ${allocated.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-1000",
                                        percent > 90 ? "bg-destructive" : percent > 70 ? "bg-amber-500" : "bg-primary"
                                    )}
                                    style={{ width: `${Math.min(percent, 100)}%` }}
                                />
                            </div>

                            <div className="space-y-1">
                                {budget.lines.map((line) => (
                                    <div key={line.id} className="text-[11px] text-muted-foreground flex items-center justify-between">
                                        <span className="uppercase">{line.category}</span>
                                        <span>${Number(line.spent).toLocaleString()} / ${Number(line.allocated).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                }) : null}
                {!budgetsQuery.isLoading && farmId && !budgetsQuery.data?.length ? (
                    <p className="text-xs text-muted-foreground">No budgets configured yet.</p>
                ) : null}
            </div>
        </div>
    );
}
