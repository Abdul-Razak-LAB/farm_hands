'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/components/layout/auth-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApiCall } from './api';

const spendRequestSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(5, 'Description must be at least 5 chars'),
  vendorId: z.string().optional(),
});

type SpendRequest = z.infer<typeof spendRequestSchema>;

export function SpendRequestForm({ onSuccess }: { onSuccess?: () => void }) {
  const { farmId } = useAuth();
  const queryClient = useQueryClient();
  const requestSpendMutation = useMutation({
    mutationFn: (payload: SpendRequest) => financeApiCall(`/api/farms/${farmId}/finance/requests`, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['finance-requests', farmId] });
      void queryClient.invalidateQueries({ queryKey: ['finance-budgets', farmId] });
    },
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SpendRequest>({
    resolver: zodResolver(spendRequestSchema),
    defaultValues: { amount: 0 }
  });

  const onSubmit = (data: SpendRequest) => {
    if (!farmId) return;
    requestSpendMutation.mutate(data);
    reset();
    if (onSuccess) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6 bg-card border rounded-xl shadow-lg">
      <h2 className="text-xl font-bold">Request Funds</h2>
      
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Category</label>
        <select 
          {...register('category')}
          className="w-full bg-accent/50 border-none rounded-md px-3 py-2 text-sm focus:ring-2 ring-primary"
        >
          <option value="FUEL">Fuel</option>
          <option value="FERTILIZER">Fertilizer</option>
          <option value="SEED">Seeds</option>
          <option value="REPAIRS">Maintenance / Repairs</option>
          <option value="WAGES">Casual Wages</option>
        </select>
        {errors.category && <p className="text-destructive text-[10px]">{errors.category.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Amount (GHS)</label>
        <input 
          type="number"
          step="0.01"
          {...register('amount', { valueAsNumber: true })}
          className="w-full bg-accent/50 border-none rounded-md px-3 py-2 text-sm focus:ring-2 ring-primary"
        />
        {errors.amount && <p className="text-destructive text-[10px]">{errors.amount.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
        <textarea 
          {...register('description')}
          className="w-full bg-accent/50 border-none rounded-md px-3 py-2 text-sm min-h-[80px]"
          placeholder="What is this for?"
        />
        {errors.description && <p className="text-destructive text-[10px]">{errors.description.message}</p>}
      </div>

      <button
        type="submit"
        disabled={requestSpendMutation.isPending || !farmId}
        className="w-full bg-primary text-primary-foreground py-2 font-bold rounded-lg shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {requestSpendMutation.isPending ? 'Saving Request...' : 'Submit Fund Request'}
      </button>
    </form>
  );
}
