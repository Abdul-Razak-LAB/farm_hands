import { createErrorResponse } from '@/lib/errors';
import { requireJobSecret } from '@/lib/job-auth';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    requireJobSecret(request);
    const input = await request.json() as { farmId: string; fileUrl: string; contentType: string };

    const summary = `Digest input captured from ${input.contentType} asset.`;

    logger.info('summarize-digest-input job completed', {
      farmId: input.farmId,
      fileUrl: input.fileUrl,
      contentType: input.contentType,
    });

    return Response.json({
      success: true,
      data: {
        processed: true,
        summary,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
