import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type SignedUploadDescriptor = {
  uploadId: string;
  uploadUrl: string;
  fileUrl: string;
  method: 'PUT';
  provider: 'local' | 'r2';
  requiredHeaders?: Record<string, string>;
};

const MAX_BYTES_BY_KIND: Record<'image' | 'video' | 'audio' | 'document', number> = {
  image: 8 * 1024 * 1024,
  video: 40 * 1024 * 1024,
  audio: 12 * 1024 * 1024,
  document: 10 * 1024 * 1024,
};

function getMediaKind(contentType: string) {
  if (contentType.startsWith('image/')) return 'image' as const;
  if (contentType.startsWith('video/')) return 'video' as const;
  if (contentType.startsWith('audio/')) return 'audio' as const;
  return 'document' as const;
}

export function validateUploadRequest(contentType: string, sizeBytes: number) {
  const kind = getMediaKind(contentType || 'application/octet-stream');
  const maxBytes = MAX_BYTES_BY_KIND[kind];
  if (sizeBytes > maxBytes) {
    throw new Error(`Payload too large for ${kind}; max ${maxBytes} bytes`);
  }
}

function getR2Client() {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function createSignedUploadDescriptor(
  basePath: string,
  scope: string,
  fileName: string,
  contentType = 'application/octet-stream',
): Promise<SignedUploadDescriptor> {
  const uploadId = crypto.randomUUID();
  const safeName = sanitizeFileName(fileName || 'upload.bin');
  const objectKey = `${scope}/${uploadId}-${safeName}`;

  const r2Client = getR2Client();
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;

  if (r2Client && bucket) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });
    const publicBase = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
    const fileUrl = publicBase
      ? `${publicBase.replace(/\/$/, '')}/${objectKey}`
      : `r2://${bucket}/${objectKey}`;

    return {
      uploadId,
      uploadUrl,
      fileUrl,
      method: 'PUT',
      provider: 'r2',
      requiredHeaders: contentType ? { 'Content-Type': contentType } : undefined,
    };
  }

  return {
    uploadId,
    uploadUrl: `${basePath}/${uploadId}?filename=${encodeURIComponent(safeName)}`,
    fileUrl: `/uploads/${scope}/${uploadId}-${safeName}`,
    method: 'PUT',
    provider: 'local',
  };
}

export async function persistUploadedFile(scope: string, uploadId: string, fileName: string, data: ArrayBuffer) {
  const safeName = sanitizeFileName(fileName || 'upload.bin');
  const relativeDir = path.join('uploads', scope);
  const absoluteDir = path.join(process.cwd(), 'public', relativeDir);

  await mkdir(absoluteDir, { recursive: true });

  const storedName = `${uploadId}-${safeName}`;
  const absoluteFile = path.join(absoluteDir, storedName);
  await writeFile(absoluteFile, Buffer.from(data));

  return `/uploads/${scope}/${storedName}`;
}
