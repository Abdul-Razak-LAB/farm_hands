'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOfflineAction } from '@/hooks/use-offline-sync';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/solid';

const movementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  itemId: z.string().min(1, 'Item selection is required'),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.string().min(1, 'Reason is required'),
  lotNumber: z.string().optional(),
});

type Movement = z.infer<typeof movementSchema>;

export function InventoryMovementForm() {
  const { mutate: logMovement, isPending } = useOfflineAction('inventory', 'INVENTORY_MOVED');
  
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<Movement>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: 'OUT' }
  });

  const movementType = watch('type');

  const onSubmit = (data: Movement) => {
    logMovement({
      ...data,
      timestamp: new Date().toISOString(),
    });
    reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-accent/30 p-1 rounded-xl">
        {[
          { id: 'IN', icon: ArrowTrendingUpIcon, label: 'Add Stock' },
          { id: 'OUT', icon: ArrowTrendingDownIcon, label: 'Use Stock' },
          { id: 'ADJUSTMENT', icon: AdjustmentsHorizontalIcon, label: 'Correction' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => reset({ ...watch(), type: t.id as any })}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${
              movementType === t.id ? 'bg-background shadow-sm ring-1 ring-border' : 'text-muted-foreground opacity-60'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Item / Input</label>
          <select 
            {...register('itemId')}
            className="w-full h-12 bg-accent/50 border-none rounded-xl px-4 text-sm font-medium focus:ring-2 ring-primary"
          >
            <option value="">Select an item...</option>
            <option value="item-1">NPK Fertilizer (50kg Bag)</option>
            <option value="item-2">Weedicide A (1L)</option>
            <option value="item-3">Maize Seed (DK777)</option>
          </select>
          {errors.itemId && <p className="text-destructive text-[10px] px-1">{errors.itemId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Quantity</label>
            <input 
              type="number"
              {...register('quantity', { valueAsNumber: true })}
              className="w-full h-12 bg-accent/50 border-none rounded-xl px-4 text-sm font-medium focus:ring-2 ring-primary"
              placeholder="0.00"
            />
            {errors.quantity && <p className="text-destructive text-[10px] px-1">{errors.quantity.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Lot / Batch #</label>
            <input 
              {...register('lotNumber')}
              className="w-full h-12 bg-accent/50 border-none rounded-xl px-4 text-sm font-medium focus:ring-2 ring-primary"
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Reason / Purpose</label>
          <input 
            {...register('reason')}
            className="w-full h-12 bg-accent/50 border-none rounded-xl px-4 text-sm font-medium focus:ring-2 ring-primary"
            placeholder={movementType === 'OUT' ? 'Field Section #4 App' : 'Purchase Order #123'}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={`w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-[0.97] mt-4 ${
            movementType === 'IN' ? 'bg-primary text-primary-foreground' : 
            movementType === 'OUT' ? 'bg-orange-500 text-white' : 
            'bg-zinc-800 text-white'
          }`}
        >
          {isPending ? 'Logging...' : 'Confirm Movement'}
        </button>
      </form>
    </div>
  );
}
