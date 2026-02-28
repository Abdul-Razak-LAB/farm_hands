'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { uploadFileWithSignedEndpoint } from '@/lib/media-upload-client';
import { useIntegrationStatus } from '@/hooks/use-integration-status';
import { reportIntegrationDegraded } from '@/lib/observability';
import {
    BuildingStorefrontIcon,
    DocumentArrowUpIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';

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

export function VendorPortal() {
    const { vendorToken } = useParams();
    const token = String(vendorToken || '');
    const [acknowledged, setAcknowledged] = useState(false);
    const [poId, setPoId] = useState('');
    const [invoiceRef, setInvoiceRef] = useState('');
    const [evidenceUrl, setEvidenceUrl] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const integrationStatus = useIntegrationStatus();
    const uploadAvailable = integrationStatus.data?.upload ?? false;

    const ordersQuery = useQuery({
        queryKey: ['vendor-token-orders', token],
        queryFn: () => apiCall<any[]>(`/api/vendor/${token}/orders`),
        enabled: token.length > 0,
    });

    const confirmMutation = useMutation({
        mutationFn: () => apiCall(`/api/vendor/${token}/orders`, {
            method: 'POST',
            body: JSON.stringify({
                poId,
                invoiceNumber: invoiceRef,
                evidenceUrl: evidenceUrl || undefined,
                idempotencyKey: crypto.randomUUID(),
            }),
        }),
        onSuccess: () => {
            setAcknowledged(true);
            setInvoiceRef('');
            setEvidenceUrl('');
            void ordersQuery.refetch();
        },
    });

    const handleEvidenceUpload = async (file: File) => {
        if (!uploadAvailable) {
            setUploadError('Evidence upload is currently unavailable.');
            reportIntegrationDegraded('upload', 'Vendor evidence upload disabled by integration status');
            return;
        }

        setUploadError(null);
        setIsUploadingEvidence(true);
        setUploadProgress(0);
        try {
            const fileUrl = await uploadFileWithSignedEndpoint(`/api/vendor/${token}/media/signed-upload`, file, setUploadProgress);
            setEvidenceUrl(fileUrl);
        } finally {
            setIsUploadingEvidence(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-6 flex flex-col items-center">
            <div className="max-w-3xl w-full space-y-8">
                <div className="text-center space-y-2">
                    <div className="h-16 w-16 bg-primary rounded-2xl mx-auto flex items-center justify-center text-primary-foreground shadow-lg">
                        <BuildingStorefrontIcon className="h-10 w-10" />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight">Vendor Collaboration</h1>
                    <p className="text-muted-foreground text-sm">Secure workflow token: {String(vendorToken || '').slice(0, 10)}...</p>
                </div>

                <div className="bg-card rounded-3xl p-6 md:p-8 shadow-xl border space-y-6">
                    <div className="space-y-4">
                        <h2 className="font-bold text-lg">Order Confirmation</h2>
                        <div className="bg-accent/40 p-4 rounded-xl border flex justify-between items-center text-sm">
                            <span className="font-medium text-muted-foreground">PO ID:</span>
                            <span className="font-black text-primary text-base">{poId || 'Select order'}</span>
                        </div>
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
                        <button
                            onClick={() => confirmMutation.mutate()}
                            disabled={confirmMutation.isPending || isUploadingEvidence || !poId || invoiceRef.trim().length < 3}
                            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                        >
                            <CheckCircleIcon className="h-6 w-6" />
                            {confirmMutation.isPending ? 'Submitting...' : acknowledged ? 'PO Acknowledged' : 'Acknowledge PO'}
                        </button>
                    </div>

                    <div className="pt-6 border-t space-y-4">
                        <h2 className="font-bold text-lg">Invoice / Evidence</h2>
                        {uploadError ? (
                            <p className="text-[11px] rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                                {uploadError}
                            </p>
                        ) : null}
                        <input
                            value={invoiceRef}
                            onChange={(event) => setInvoiceRef(event.target.value)}
                            className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
                            placeholder="Invoice number"
                        />
                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            disabled={!uploadAvailable || isUploadingEvidence}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void handleEvidenceUpload(file);
                            }}
                            className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm disabled:opacity-50"
                        />
                        <div className="aspect-video border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors ring-offset-4 focus-within:ring-2 ring-primary">
                            <DocumentArrowUpIcon className="h-10 w-10" />
                            <p className="text-xs font-bold uppercase tracking-widest">PO Confirmation / Invoice Evidence</p>
                            <p className="text-[11px] text-center px-4">{isUploadingEvidence ? `Uploading evidence ${uploadProgress}%` : invoiceRef && evidenceUrl ? 'Evidence is ready to submit.' : 'Upload invoice evidence to complete confirmation.'}</p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                    Secure Link • Expires in 48 hours
                </p>
            </div>
        </div>
    );
}
