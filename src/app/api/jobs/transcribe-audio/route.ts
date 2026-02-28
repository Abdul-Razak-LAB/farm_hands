import { createErrorResponse } from '@/lib/errors';
import { requireJobSecret } from '@/lib/job-auth';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    requireJobSecret(request);
    const input = await request.json() as { farmId: string; fileUrl: string };

    const transcript = `Transcription placeholder for ${input.fileUrl}`;

    logger.info('transcribe-audio job completed', {
      farmId: input.farmId,
      fileUrl: input.fileUrl,
    });

    return Response.json({
      success: true,
      data: {
        processed: true,
        transcript,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
