import { NextRequest } from 'next/server';
import { createErrorResponse, AppError } from '@/lib/errors';
import { persistUploadedFile, validateUploadRequest } from '@/lib/media-upload-server';
import { createHash } from 'node:crypto';

function tokenScope(vendorToken: string) {
  if (!vendorToken || vendorToken.length < 3) {
    throw new AppError('INVALID_TOKEN', 'Invalid vendor token', 400);
  }

  return `vendor-${vendorToken}`;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ vendorToken: string; uploadId: string }> }
) {
  try {
    const { vendorToken, uploadId } = await context.params;
    const fileName = request.nextUrl.searchParams.get('filename') || 'upload.bin';
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const body = await request.arrayBuffer();

    validateUploadRequest(contentType, body.byteLength);

    const fileUrl = await persistUploadedFile(tokenScope(vendorToken), uploadId, fileName, body);
    const checksum = createHash('sha256').update(Buffer.from(body)).digest('hex');
    return Response.json({
      success: true,
      data: {
        fileUrl,
        checksum,
        metadata: {
          capturedAt: new Date().toISOString(),
          checksum,
        },
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
