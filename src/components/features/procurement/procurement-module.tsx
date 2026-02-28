'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const json = (await response.json()) as ApiEnvelope<T>;
  if (!json.success) {
    throw new Error(json.error?.message || 'Request failed');
  }

  return json.data as T;
}

export function ProcurementModule() {
  const { farmId } = useAuth();
  const [requestReason, setRequestReason] = useState('');
  const [requestAmount, setRequestAmount] = useState(0);
  const [vendorId, setVendorId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [deliveryPoId, setDeliveryPoId] = useState('');
  const [deliveryItemId, setDeliveryItemId] = useState('');
  const [deliveryQty, setDeliveryQty] = useState(1);
  const [discrepancyNote, setDiscrepancyNote] = useState('');

  const ordersQuery = useQuery({
    queryKey: ['procurement-orders', farmId],
    queryFn: () => apiCall<any[]>(`/api/farms/${farmId}/procurement/orders`),
    enabled: Boolean(farmId),
  });

  const requestPurchaseMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/procurement/requests`, {
      method: 'POST',
      body: JSON.stringify({
        reason: requestReason,
        amount: requestAmount,
        vendorId: vendorId || undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setRequestReason('');
      setRequestAmount(0);
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/procurement/orders`, {
      method: 'POST',
      body: JSON.stringify({
        vendorId,
        idempotencyKey: crypto.randomUUID(),
        items: [{ description: itemDescription, qty: itemQty, unitPrice: itemPrice }],
      }),
    }),
    onSuccess: () => {
      setItemDescription('');
      setItemQty(1);
      setItemPrice(0);
      void ordersQuery.refetch();
    },
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/procurement/deliveries`, {
      method: 'POST',
      body: JSON.stringify({
        poId: deliveryPoId,
        idempotencyKey: crypto.randomUUID(),
        discrepancyNote: discrepancyNote || undefined,
        items: [{ itemId: deliveryItemId, qty: deliveryQty }],
      }),
    }),
    onSuccess: () => {
      setDiscrepancyNote('');
      setDeliveryQty(1);
      void ordersQuery.refetch();
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Procurement</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Requests, POs, delivery confirmation</p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Purchase Request</h2>
        <input
          value={requestReason}
          onChange={(event) => setRequestReason(event.target.value)}
          placeholder="Reason"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <input
          type="number"
          value={requestAmount}
          onChange={(event) => setRequestAmount(Number(event.target.value))}
          placeholder="Amount"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <button
          onClick={() => requestPurchaseMutation.mutate()}
          disabled={requestPurchaseMutation.isPending || !requestReason || requestAmount <= 0}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {requestPurchaseMutation.isPending ? 'Submitting...' : 'Submit Request'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Create Purchase Order</h2>
        <input
          value={vendorId}
          onChange={(event) => setVendorId(event.target.value)}
          placeholder="Vendor ID"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <input
          value={itemDescription}
          onChange={(event) => setItemDescription(event.target.value)}
          placeholder="Item description"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={itemQty}
            onChange={(event) => setItemQty(Number(event.target.value))}
            placeholder="Qty"
            className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          />
          <input
            type="number"
            value={itemPrice}
            onChange={(event) => setItemPrice(Number(event.target.value))}
            placeholder="Unit price"
            className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          />
        </div>
        <button
          onClick={() => createOrderMutation.mutate()}
          disabled={createOrderMutation.isPending || !vendorId || !itemDescription || itemQty <= 0 || itemPrice <= 0}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {createOrderMutation.isPending ? 'Creating...' : 'Create PO'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Confirm Delivery</h2>
        <input
          value={deliveryPoId}
          onChange={(event) => setDeliveryPoId(event.target.value)}
          placeholder="PO ID"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <input
          value={deliveryItemId}
          onChange={(event) => setDeliveryItemId(event.target.value)}
          placeholder="Inventory Item ID"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <input
          type="number"
          value={deliveryQty}
          onChange={(event) => setDeliveryQty(Number(event.target.value))}
          placeholder="Delivered quantity"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <input
          value={discrepancyNote}
          onChange={(event) => setDiscrepancyNote(event.target.value)}
          placeholder="Discrepancy note (optional)"
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
        />
        <button
          onClick={() => confirmDeliveryMutation.mutate()}
          disabled={confirmDeliveryMutation.isPending || !deliveryPoId || !deliveryItemId || deliveryQty <= 0}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {confirmDeliveryMutation.isPending ? 'Confirming...' : 'Confirm Delivery'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card">
        <h2 className="text-sm font-bold uppercase mb-3">Recent POs</h2>
        <div className="space-y-2">
          {ordersQuery.data?.length ? ordersQuery.data.map((order: any) => (
            <div key={order.id} className="p-2 rounded-md bg-accent/20 text-xs flex justify-between">
              <span className="font-medium">{order.id.slice(0, 10)}</span>
              <span className="uppercase text-muted-foreground">{order.status}</span>
            </div>
          )) : <p className="text-xs text-muted-foreground">No purchase orders yet.</p>}
        </div>
      </section>
    </div>
  );
}
