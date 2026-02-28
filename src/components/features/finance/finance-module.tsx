'use client';

import { ApprovalInbox } from '@/components/features/finance/approval-inbox';
import { BudgetOverview } from '@/components/features/finance/budget-overview';
import { SpendRequestForm } from '@/components/features/finance/spend-request-form';

export function FinanceModule() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Spend governance</p>
      </header>

      <section className="space-y-4">
        <SpendRequestForm />
      </section>

      <section className="space-y-4">
        <BudgetOverview />
      </section>

      <section className="space-y-4">
        <ApprovalInbox />
      </section>
    </div>
  );
}
