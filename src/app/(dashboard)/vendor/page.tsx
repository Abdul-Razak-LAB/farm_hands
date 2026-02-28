'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { uploadFileWithSignedEndpoint } from '@/lib/media-upload-client';

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

export default function VendorPage() {
  const { farmId } = useAuth();
  const [poId, setPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ['vendor-orders', farmId],
    queryFn: () => apiCall<any[]>(`/api/farms/${farmId}/vendor/orders`),
    enabled: Boolean(farmId),
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/vendor/orders`, {
      method: 'POST',
      body: JSON.stringify({
        poId,
        invoiceNumber,
        evidenceUrl: evidenceUrl || undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setInvoiceNumber('');
      setEvidenceUrl('');
      void ordersQuery.refetch();
    },
  });

  const handleEvidenceUpload = async (file: File) => {
    if (!farmId) return;
    setIsUploadingEvidence(true);
    setUploadProgress(0);
    try {
      const fileUrl = await uploadFileWithSignedEndpoint(`/api/farms/${farmId}/media/signed-upload`, file, setUploadProgress);
      setEvidenceUrl(fileUrl);
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Vendor Portal</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">PO confirmation and invoice evidence</p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-2">
        <h2 className="text-sm font-bold uppercase">Confirm Purchase Order</h2>
        <input
          value={poId}
          onChange={(event) => setPoId(event.target.value)}
          placeholder="PO ID"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <input
          value={invoiceNumber}
          onChange={(event) => setInvoiceNumber(event.target.value)}
          placeholder="Invoice Number"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleEvidenceUpload(file);
          }}
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <p className="text-[11px] text-muted-foreground">{isUploadingEvidence ? `Uploading evidence ${uploadProgress}%` : evidenceUrl ? 'Evidence uploaded' : 'Evidence optional'}</p>
        <button
          onClick={() => confirmMutation.mutate()}
          disabled={confirmMutation.isPending || isUploadingEvidence || !poId || !invoiceNumber}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {confirmMutation.isPending ? 'Submitting...' : 'Confirm Order'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card">
        <h2 className="text-sm font-bold uppercase mb-3">Open Orders</h2>
        <div className="space-y-2">
          {ordersQuery.data?.length ? ordersQuery.data.map((order: any) => (
            <button
              key={order.id}
              onClick={() => setPoId(order.id)}
              className="w-full text-left p-3 rounded-md bg-accent/20"
            >
              <div className="flex justify-between text-xs">
                <span className="font-semibold">{order.id.slice(0, 10)}</span>
                <span className="uppercase text-muted-foreground">{order.status}</span>
              </div>
              <p className="text-[11px] mt-1 text-muted-foreground">Vendor: {order.vendor?.name ?? 'Unknown'}</p>
            </button>
          )) : <p className="text-xs text-muted-foreground">No open vendor orders.</p>}
        </div>
      </section>
    </div>
  );
}
