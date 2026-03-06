'use client';

import { useAuth } from '@/components/layout/auth-provider';
import type { IncidentEvent } from '@/lib/api/contracts';
import { getFarmData, postFarmData } from '@/lib/api/farm-client';
import { formatDate } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { uploadFileWithSignedEndpoint } from '@/lib/media-upload-client';
import { useIntegrationStatus } from '@/hooks/use-integration-status';
import { CameraIcon } from '@heroicons/react/24/outline';

export function IncidentsModule() {
  const { farmId } = useAuth();
  const integrationStatus = useIntegrationStatus();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [evidenceImageUrl, setEvidenceImageUrl] = useState('');
  const [evidenceImageName, setEvidenceImageName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [issueEventId, setIssueEventId] = useState('');
  const [resolution, setResolution] = useState('');

  const uploadAvailable = integrationStatus.data?.upload !== false;

  const timelineQuery = useQuery({
    queryKey: ['incident-timeline', farmId],
    queryFn: () => getFarmData<IncidentEvent[]>(farmId!, '/incidents'),
    enabled: Boolean(farmId),
  });

  const reportMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/incidents', {
        title,
        details: details || undefined,
        severity,
        evidenceImageUrl: evidenceImageUrl || undefined,
        evidenceImageName: evidenceImageName || undefined,
        idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      setTitle('');
      setDetails('');
      setEvidenceImageUrl('');
      setEvidenceImageName('');
      setUploadProgress(0);
      setUploadError(null);
      void timelineQuery.refetch();
    },
  });

  const handleEvidenceUpload = async (file: File) => {
    if (!farmId) return;

    if (!uploadAvailable) {
      setUploadError('Image upload is currently unavailable.');
      return;
    }

    setUploadError(null);
    setIsUploadingEvidence(true);
    setUploadProgress(0);

    try {
      const fileUrl = await uploadFileWithSignedEndpoint(`/api/farms/${farmId}/media/signed-upload`, file, setUploadProgress);
      setEvidenceImageUrl(fileUrl);
      setEvidenceImageName(file.name);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Unable to upload evidence image.');
      setEvidenceImageUrl('');
      setEvidenceImageName('');
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  const expertMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/incidents/expert-request', {
        issueEventId,
        idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      void timelineQuery.refetch();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/incidents/resolve', {
        issueEventId,
        resolution,
        idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      setResolution('');
      void timelineQuery.refetch();
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Escalation, expert support, resolution tracking</p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-2">
        <h2 className="text-sm font-bold uppercase">Report Issue</h2>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Issue title"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')}
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        >
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Details"
          className="w-full min-h-[80px] rounded-md bg-accent/40 px-3 py-2 text-sm"
        />
        <input
          id="incident-evidence-image"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={!uploadAvailable || isUploadingEvidence}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleEvidenceUpload(file);
            }
            event.target.value = '';
          }}
          className="sr-only"
        />
        <label
          htmlFor="incident-evidence-image"
          className={`w-full h-10 rounded-md border bg-accent/40 px-3 text-sm inline-flex items-center justify-center gap-2 ${!uploadAvailable || isUploadingEvidence ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:bg-accent/60'}`}
        >
          <CameraIcon className="h-4 w-4" />
          Choose file / Capture image
        </label>
        {uploadError ? (
          <p className="text-[11px] text-destructive">{uploadError}</p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          {isUploadingEvidence
            ? `Uploading evidence ${uploadProgress}%`
            : evidenceImageUrl
              ? `Evidence attached: ${evidenceImageName || 'image'}`
              : 'No evidence image attached'}
        </p>
        <button
          onClick={() => reportMutation.mutate()}
          disabled={reportMutation.isPending || isUploadingEvidence || title.trim().length < 3}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {reportMutation.isPending ? 'Reporting...' : 'Report Incident'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-2">
        <h2 className="text-sm font-bold uppercase">Issue Action</h2>
        <input
          value={issueEventId}
          onChange={(event) => setIssueEventId(event.target.value)}
          placeholder="Issue Event ID"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <input
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          placeholder="Resolution note"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={() => expertMutation.mutate()}
            disabled={expertMutation.isPending || !issueEventId}
            className="h-10 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold disabled:opacity-50"
          >
            Request Expert
          </button>
          <button
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending || !issueEventId || resolution.trim().length < 3}
            className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            Resolve
          </button>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card">
        <h2 className="text-sm font-bold uppercase mb-2">Issue Timeline</h2>
        <div className="space-y-2">
          {timelineQuery.data?.length ? timelineQuery.data.map((event) => (
            <div key={event.id} className="p-3 rounded-md bg-accent/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">{event.type}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(event.createdAt)}</p>
              </div>
              <p className="text-[11px] mt-1 text-muted-foreground">{JSON.stringify(event.payload)}</p>
              {typeof (event.payload as { evidenceImageUrl?: unknown } | undefined)?.evidenceImageUrl === 'string' ? (
                <a
                  href={(event.payload as { evidenceImageUrl: string }).evidenceImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-[11px] font-semibold text-primary underline underline-offset-4"
                >
                  View Evidence
                </a>
              ) : null}
            </div>
          )) : <p className="text-xs text-muted-foreground">No incident events yet.</p>}
        </div>
      </section>
    </div>
  );
}
