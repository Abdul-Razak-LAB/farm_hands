'use client';

import { useAuth } from '@/components/layout/auth-provider';
import type { MessageAttachment, MessageRecord } from '@/lib/api/contracts';
import { getFarmData, postFarmData } from '@/lib/api/farm-client';
import { uploadFileWithSignedEndpoint } from '@/lib/media-upload-client';
import { formatDate } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export function MessagesModule() {
  const { farmId } = useAuth();
  const [text, setText] = useState('');
  const [threadId, setThreadId] = useState('general');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);

  const messagesQuery = useQuery({
    queryKey: ['messages', farmId],
    queryFn: () => getFarmData<MessageRecord[]>(farmId!, '/messages?limit=100'),
    enabled: Boolean(farmId),
    refetchInterval: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/messages', {
        threadId,
        text,
        attachments,
        idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      setText('');
      setAttachments([]);
      void messagesQuery.refetch();
    },
  });

  const uploadAttachment = async (file: File) => {
    if (!farmId) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const fileUrl = await uploadFileWithSignedEndpoint(`/api/farms/${farmId}/media/signed-upload`, file, setUploadProgress);
      setAttachments((current) => [...current, {
        fileUrl,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      }]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Communication & Collaboration</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">In-app messaging with document/photo/video sharing</p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">New Message</h2>
        <div className="grid gap-2 md:grid-cols-[220px_1fr]">
          <select value={threadId} onChange={(event) => setThreadId(event.target.value)} className="h-10 rounded-md bg-accent/40 px-3 text-sm">
            <option value="general">General</option>
            <option value="operations">Operations</option>
            <option value="alerts">Alerts</option>
            <option value="procurement">Procurement</option>
          </select>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write a message"
            className="h-10 rounded-md bg-accent/40 px-3 text-sm"
          />
        </div>
        <input
          type="file"
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadAttachment(file);
          }}
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm disabled:opacity-50"
        />
        <p className="text-[11px] text-muted-foreground">{uploading ? `Uploading ${uploadProgress}%` : attachments.length ? `${attachments.length} attachment(s) ready` : 'No attachments selected'}</p>
        <button
          onClick={() => sendMutation.mutate()}
          disabled={sendMutation.isPending || text.trim().length < 1}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {sendMutation.isPending ? 'Sending...' : 'Send Message'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Recent Messages</h2>
        <div className="space-y-2">
          {messagesQuery.data?.length ? messagesQuery.data.map((message) => (
            <div key={message.id} className="rounded-md bg-accent/20 px-3 py-2 text-sm">
              <p className="font-medium">{message.payload?.text || ''}</p>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>Thread: {message.payload?.threadId || 'general'}</span>
                <span>User: {message.userId || 'unknown'}</span>
                <span>{formatDate(message.createdAt)}</span>
              </div>
              {Array.isArray(message.payload?.attachments) && message.payload.attachments.length ? (
                <div className="mt-2 space-y-1">
                  {message.payload.attachments.map((attachment) => (
                    <a
                      key={`${message.id}-${attachment.fileUrl}`}
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs text-primary underline"
                    >
                      {attachment.fileName || 'Attachment'}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          )) : <p className="text-xs text-muted-foreground">No messages yet.</p>}
        </div>
      </section>
    </div>
  );
}
