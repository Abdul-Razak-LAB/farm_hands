'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, XMarkIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { financeApiCall } from './api';

type SpendRequestRecord = {
    id: string;
    amount: number | string;
    category: string;
    description: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export function ApprovalInbox() {
    const { farmId, role } = useAuth();
    const queryClient = useQueryClient();

    const requestsQuery = useQuery({
        queryKey: ['finance-requests', farmId],
        queryFn: () => financeApiCall<SpendRequestRecord[]>(`/api/farms/${farmId}/finance/requests`),
        enabled: Boolean(farmId),
    });

    const decisionMutation = useMutation({
        mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) => financeApiCall(
            `/api/farms/${farmId}/finance/requests/${id}/decision`,
            {
                method: 'POST',
                body: JSON.stringify({
                    decision,
                    idempotencyKey: crypto.randomUUID(),
                }),
            }
        ),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['finance-requests', farmId] });
            void queryClient.invalidateQueries({ queryKey: ['finance-budgets', farmId] });
        },
    });

    const pendingRequests = (requestsQuery.data ?? []).filter((request) => request.status === 'PENDING');

    const handleDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
        if (!farmId || role !== 'OWNER') return;
        decisionMutation.mutate({ id, decision });
    };

    return (
        <div className="p-4 space-y-6">
            <h1 className="text-2xl font-bold">Pending Approvals</h1>

            <div className="grid gap-4">
                {!farmId ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-2xl">
                        <p className="text-muted-foreground">Select a farm to view approval inbox.</p>
                    </div>
                ) : requestsQuery.isLoading ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-2xl">
                        <p className="text-muted-foreground">Loading spend requests...</p>
                    </div>
                ) : pendingRequests.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-2xl">
                        <p className="text-muted-foreground">All caught up! No pending requests.</p>
                    </div>
                ) : (
                    pendingRequests.map((req) => (
                        <div key={req.id} className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                                        <CurrencyDollarIcon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Request {req.id.slice(0, 8)}</h3>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">{req.category}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-primary">${Number(req.amount).toLocaleString()}</p>
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground">{req.description}</p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleDecision(req.id, 'APPROVED')}
                                    disabled={decisionMutation.isPending || role !== 'OWNER'}
                                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <CheckIcon className="h-5 w-5" />
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleDecision(req.id, 'REJECTED')}
                                    disabled={decisionMutation.isPending || role !== 'OWNER'}
                                    className="flex-1 py-3 bg-accent text-accent-foreground rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                    Decline
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
