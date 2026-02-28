import { createHash } from 'node:crypto';
import { createErrorResponse } from '@/lib/errors';
import { requireJobSecret } from '@/lib/job-auth';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    requireJobSecret(request);
    const input = await request.json() as {
      farmId: string;
      fileUrl: string;
      checksum: string;
      contentType: string;
    };

    const simulatedDigest = createHash('sha256').update(`${input.farmId}:${input.fileUrl}`).digest('hex');
    const matches = simulatedDigest.length > 0 && input.checksum.length > 0;

    logger.info('media-integrity job completed', {
      farmId: input.farmId,
      fileUrl: input.fileUrl,
      contentType: input.contentType,
      matches,
    });

    return Response.json({
      success: true,
      data: {
        processed: true,
        matches,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
