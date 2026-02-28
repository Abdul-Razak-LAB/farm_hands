import { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/errors';
import { requirePermission } from '@/lib/permissions';
import { persistUploadedFile, validateUploadRequest } from '@/lib/media-upload-server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { enqueueDelayedJob } from '@/lib/integrations/queue/qstash';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ farmId: string; uploadId: string }> }
) {
  try {
    requirePermission(request, 'updates:write');
    const { farmId, uploadId } = await context.params;
    const fileName = request.nextUrl.searchParams.get('filename') || 'upload.bin';
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const body = await request.arrayBuffer();

    validateUploadRequest(contentType, body.byteLength);

    const fileUrl = await persistUploadedFile(farmId, uploadId, fileName, body);

    const checksum = createHash('sha256').update(Buffer.from(body)).digest('hex');
    await prisma.attachment.create({
      data: {
        farmId,
        fileName,
        fileUrl,
        contentType,
        size: body.byteLength,
        hash: checksum,
        metadata: {
          capturedAt: new Date().toISOString(),
          gps: {
            lat: request.headers.get('x-gps-lat') || null,
            lng: request.headers.get('x-gps-lng') || null,
          },
          device: request.headers.get('x-device-id') || null,
          checksum,
        },
      },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    await enqueueDelayedJob({
      url: `${appUrl}/api/jobs/media-integrity`,
      payload: { farmId, fileUrl, checksum, contentType },
      delaySeconds: 5,
    });

    if (contentType.startsWith('audio/')) {
      await enqueueDelayedJob({
        url: `${appUrl}/api/jobs/transcribe-audio`,
        payload: { farmId, fileUrl },
        delaySeconds: 5,
      });
    }

    if (contentType.includes('pdf') || contentType.startsWith('image/')) {
      await enqueueDelayedJob({
        url: `${appUrl}/api/jobs/extract-receipt`,
        payload: { farmId, fileUrl },
        delaySeconds: 5,
      });
    }

    await enqueueDelayedJob({
      url: `${appUrl}/api/jobs/summarize-digest-input`,
      payload: { farmId, fileUrl, contentType },
      delaySeconds: 5,
    });

    return Response.json({ success: true, data: { fileUrl } });
  } catch (error) {
    return createErrorResponse(error);
  }
}
