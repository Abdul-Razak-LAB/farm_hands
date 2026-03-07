'use client';

import { useRef, useState } from 'react';
import { useOfflineAction } from '@/hooks/use-offline-sync';
import { CheckBadgeIcon, XCircleIcon, CameraIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/layout/auth-provider';
import { uploadFileWithSignedEndpoint } from '@/lib/media-upload-client';
import { useIntegrationStatus } from '@/hooks/use-integration-status';

interface AuditorItem {
  id: string;
  question: string;
  type: 'BINARY' | 'QUANTITATIVE';
}

const AUDIT_QUESTIONS: AuditorItem[] = [
  { id: 'q1', question: 'Are boundaries clear and free of encroachment?', type: 'BINARY' },
  { id: 'q2', question: 'Is the crop showing signs of water stress?', type: 'BINARY' },
  { id: 'q3', question: 'Estimated germination rate (percentage)', type: 'QUANTITATIVE' },
  { id: 'q4', question: 'Evidence of recent pest activity observed?', type: 'BINARY' },
];

export function VerificationAudit() {
  const { farmId } = useAuth();
  const integrationStatus = useIntegrationStatus();
  const [results, setResults] = useState<Record<string, {
    value: any;
    comment?: string;
    evidencePhotoUrl?: string;
    evidencePhotoName?: string;
    evidenceCapturedAt?: string;
  }>>({});
  const [captureTargetId, setCaptureTargetId] = useState<string | null>(null);
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { mutate: submitAudit, isPending } = useOfflineAction('verification', 'AUDIT_COMPLETED');
  const uploadAvailable = integrationStatus.data?.upload !== false;

  const updateResponse = (id: string, value: any) => {
    setResults(prev => ({ ...prev, [id]: { ...prev[id], value } }));
  };

  const addComment = (id: string, comment: string) => {
    setResults(prev => ({ ...prev, [id]: { ...prev[id], comment } }));
  };

  const openCameraForQuestion = (id: string) => {
    if (!uploadAvailable) {
      setMediaError('Upload integration is unavailable. Evidence photo capture is disabled.');
      return;
    }

    setMediaError(null);
    setCaptureTargetId(id);
    fileInputRef.current?.click();
  };

  const handleEvidenceCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const questionId = captureTargetId;

    if (!file || !questionId || !farmId) {
      event.target.value = '';
      return;
    }

    setUploadingQuestionId(questionId);
    setUploadProgress(0);
    setMediaError(null);

    try {
      const endpoint = `/api/farms/${farmId}/media/signed-upload`;
      const evidencePhotoUrl = await uploadFileWithSignedEndpoint(endpoint, file, setUploadProgress);

      setResults((prev) => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          evidencePhotoUrl,
          evidencePhotoName: file.name,
          evidenceCapturedAt: new Date().toISOString(),
        },
      }));
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Unable to upload evidence photo.');
    } finally {
      setUploadingQuestionId(null);
      setCaptureTargetId(null);
      event.target.value = '';
    }
  };

  const handleFinish = () => {
    submitAudit({
      results,
      auditedAt: new Date().toISOString(),
      integrityHash: 'audit-chain-init'
    });
    setResults({});
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20">
        <h3 className="text-sm font-black text-primary uppercase tracking-tighter">Assigned Verification Audit</h3>
        <p className="text-[10px] text-muted-foreground uppercase font-bold">Protocol: Standard Crop Progress v2</p>
      </div>

      <div className="space-y-4">
        {mediaError ? (
          <p className="text-[11px] rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
            {mediaError}
          </p>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            void handleEvidenceCapture(event);
          }}
          className="hidden"
        />

        {AUDIT_QUESTIONS.map((q) => (
          <div key={q.id} className="p-5 bg-card border rounded-2xl shadow-sm space-y-4">
            <p className="text-sm font-semibold leading-tight">{q.question}</p>
            
            {q.type === 'BINARY' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => updateResponse(q.id, true)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 border-2 rounded-xl text-xs font-bold transition-all",
                    results[q.id]?.value === true ? "bg-primary border-primary text-primary-foreground" : "border-accent text-muted-foreground"
                  )}
                >
                  <CheckBadgeIcon className="h-4 w-4" /> YES
                </button>
                <button
                  onClick={() => updateResponse(q.id, false)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 border-2 rounded-xl text-xs font-bold transition-all",
                    results[q.id]?.value === false ? "bg-destructive border-destructive text-white" : "border-accent text-muted-foreground"
                  )}
                >
                  <XCircleIcon className="h-4 w-4" /> NO
                </button>
              </div>
            ) : (
              <input 
                type="number"
                onChange={(e) => updateResponse(q.id, e.target.value)}
                placeholder="Enter value..."
                className="w-full h-12 bg-accent/30 border-none rounded-xl px-4 text-sm font-bold"
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => openCameraForQuestion(q.id)}
                disabled={!uploadAvailable || uploadingQuestionId === q.id}
                className={cn(
                  "h-10 w-10 flex items-center justify-center rounded-xl text-muted-foreground disabled:opacity-50",
                  results[q.id]?.evidencePhotoUrl ? 'bg-primary/20 text-primary' : ''
                )}
                title="Attach Evidence Photo"
              >
                <CameraIcon className="h-5 w-5" />
              </button>
              <input 
                placeholder="Add observation note..."
                onChange={(e) => addComment(q.id, e.target.value)}
                className="flex-1 bg-accent/20 border-none rounded-xl px-4 text-xs h-10 italic"
              />
            </div>

            <div className="text-[11px] text-muted-foreground">
              {uploadingQuestionId === q.id
                ? `Uploading evidence ${uploadProgress}%`
                : results[q.id]?.evidencePhotoUrl
                  ? `Evidence attached: ${results[q.id]?.evidencePhotoName || 'photo'}`
                  : 'No evidence photo attached'}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleFinish}
        disabled={isPending || Object.keys(results).length < AUDIT_QUESTIONS.length}
        className="w-full h-16 bg-zinc-950 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-30"
      >
        {isPending ? 'Queuing Verification...' : 'Seal & Submit Audit'}
      </button>
    </div>
  );
}

