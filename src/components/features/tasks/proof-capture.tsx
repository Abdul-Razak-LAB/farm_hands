'use client';

import { useState } from 'react';
import { useOfflineAction } from '@/hooks/use-offline-sync';
import { CameraIcon, MicrophoneIcon, VideoCameraIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/layout/auth-provider';
import { uploadFileWithSignedEndpoint } from '@/lib/media-upload-client';
import { useIntegrationStatus } from '@/hooks/use-integration-status';
import { reportIntegrationDegraded } from '@/lib/observability';
import { compressImageFile, getVideoDurationInSeconds, isNearStorageQuota } from '@/lib/media-safety';

export function ProofCapture({ taskId, onComplete }: { taskId: string, onComplete: () => void }) {
  const { farmId } = useAuth();
  const integrationStatus = useIntegrationStatus();
  const [photoUrl, setPhotoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [voiceNote, setVoiceNote] = useState('');
  const [photoProgress, setPhotoProgress] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [photoOnlyMode, setPhotoOnlyMode] = useState(false);
  const [metadataPreview, setMetadataPreview] = useState<{ lat: number; lng: number; capturedAt: string } | null>(null);
  const { mutate: completeTask, isPending } = useOfflineAction('tasks', 'TASK_COMPLETED');

  const uploadAvailable = integrationStatus.data?.upload ?? false;

  const uploadMedia = async (file: File, type: 'photo' | 'video') => {
    if (!farmId) return;

    setMediaError(null);

    if (!uploadAvailable) {
      reportIntegrationDegraded('upload', 'Upload integration unavailable during proof capture');
      setMediaError('Media upload is temporarily unavailable. You can still submit task notes.');
      return;
    }

    const nearQuota = await isNearStorageQuota();
    if (nearQuota) {
      setPhotoOnlyMode(true);
      if (type === 'video') {
        setMediaError('Storage is near quota. Video is disabled; use photo-only capture.');
        return;
      }
    }

    const endpoint = `/api/farms/${farmId}/media/signed-upload`;

    if (type === 'photo') {
      setIsUploadingPhoto(true);
      setPhotoProgress(0);
      try {
        const compressed = await compressImageFile(file);
        const fileUrl = await uploadFileWithSignedEndpoint(endpoint, compressed, setPhotoProgress);
        setPhotoUrl(fileUrl);
      } finally {
        setIsUploadingPhoto(false);
      }
      return;
    }

    try {
      const durationSeconds = await getVideoDurationInSeconds(file);
      if (durationSeconds < 5 || durationSeconds > 15) {
        setMediaError('Video must be between 5 and 15 seconds.');
        return;
      }
    } catch {
      setMediaError('Could not verify video length. Please retry.');
      return;
    }

    setIsUploadingVideo(true);
    setVideoProgress(0);
    try {
      const fileUrl = await uploadFileWithSignedEndpoint(endpoint, file, setVideoProgress);
      setVideoUrl(fileUrl);
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleCapture = async () => {
    const capturedAt = new Date().toISOString();

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
        })
      );

      const proofPayload = {
        taskId,
        capturedAt,
        metadata: {
          time: capturedAt,
          gps: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        },
        attachments: {
          photo: photoUrl || undefined,
          video: videoUrl || undefined,
          voice: voiceNote || undefined,
        },
      };

      setMetadataPreview({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        capturedAt,
      });

      completeTask(proofPayload, {
        onSuccess: () => {
          setPhotoUrl('');
          setVideoUrl('');
          setVoiceNote('');
          setRecording(false);
          onComplete();
        },
      });
    } catch {
      completeTask({
        taskId,
        capturedAt,
        metadata: { time: capturedAt },
        attachments: {
          photo: photoUrl || undefined,
          video: videoUrl || undefined,
          voice: voiceNote || undefined,
        },
      }, {
        onSuccess: () => onComplete(),
      });
    }
  };

  return (
    <div className="p-4 space-y-4 border rounded-lg bg-card shadow-sm">
      <h3 className="font-semibold text-sm">Proof of Work</h3>

      {!uploadAvailable ? (
        <p className="text-[11px] rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
          Upload integration is unavailable. Capture controls are disabled.
        </p>
      ) : null}

      {mediaError ? (
        <p className="text-[11px] rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
          {mediaError}
        </p>
      ) : null}

      {photoOnlyMode ? (
        <p className="text-[11px] rounded-md border p-2 text-muted-foreground">
          Storage threshold reached: switched to photo-only mode.
        </p>
      ) : null}
      
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 border-2 border-dashed rounded-md space-y-2">
          <CameraIcon className="h-8 w-8 text-muted-foreground" />
          <input
            type="file"
            accept="image/*"
            disabled={!uploadAvailable || isUploadingPhoto || isUploadingVideo}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadMedia(file, 'photo');
            }}
            className="w-full h-8 rounded bg-accent/50 px-2 text-[10px] disabled:opacity-50"
          />
          <p className="text-[10px] text-muted-foreground">{isUploadingPhoto ? `Uploading ${photoProgress}%` : photoUrl ? 'Uploaded' : 'No file'}</p>
        </div>

        <div className="p-3 border-2 border-dashed rounded-md space-y-2">
          <VideoCameraIcon className="h-8 w-8 text-muted-foreground" />
          <input
            type="file"
            accept="video/*"
            disabled={!uploadAvailable || photoOnlyMode || isUploadingPhoto || isUploadingVideo}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadMedia(file, 'video');
            }}
            className="w-full h-8 rounded bg-accent/50 px-2 text-[10px] disabled:opacity-50"
          />
          <p className="text-[10px] text-muted-foreground">{photoOnlyMode ? 'Disabled near quota' : isUploadingVideo ? `Uploading ${videoProgress}%` : videoUrl ? 'Uploaded' : 'No file'}</p>
        </div>

        <button
          className={cn(
            "flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md transition-colors",
            recording ? "bg-destructive/10 border-destructive" : "hover:bg-accent"
          )}
          onClick={() => setRecording(!recording)}
        >
          <MicrophoneIcon className={cn("h-8 w-8", recording ? "text-destructive animate-pulse" : "text-muted-foreground")} />
          <span className="text-[10px] mt-1 uppercase">{recording ? 'Recording...' : 'Add Voice'}</span>
        </button>
      </div>

      <input
        value={voiceNote}
        onChange={(event) => setVoiceNote(event.target.value)}
        placeholder="Voice transcript or note"
        className="w-full h-10 rounded-md bg-accent/50 px-3 text-xs"
      />

      <div className="rounded-md border bg-accent/20 p-3 text-[11px] text-muted-foreground space-y-1">
        <p className="font-semibold uppercase text-[10px]">Metadata to attach</p>
        <p className="flex items-center gap-1"><ClockIcon className="h-3 w-3" /> Time: {metadataPreview?.capturedAt ?? 'Captured on submit'}</p>
        <p className="flex items-center gap-1"><MapPinIcon className="h-3 w-3" /> GPS: {metadataPreview ? `${metadataPreview.lat.toFixed(5)}, ${metadataPreview.lng.toFixed(5)}` : 'Will request device location'}</p>
      </div>

      <button
        onClick={handleCapture}
        disabled={isPending || isUploadingPhoto || isUploadingVideo}
        className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-md active:scale-95 transition-all shadow-md"
      >
        {isPending ? 'Queuing sync...' : 'Complete Task'}
      </button>
    </div>
  );
}
