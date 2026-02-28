import { createErrorResponse } from '@/lib/errors';
import { requireJobSecret } from '@/lib/job-auth';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    requireJobSecret(request);
    const input = await request.json() as { farmId: string; fileUrl: string };

    const extracted = {
      vendorName: 'Unknown Vendor',
      total: null,
      currency: null,
    };

    logger.info('extract-receipt job completed', {
      farmId: input.farmId,
      fileUrl: input.fileUrl,
    });

    return Response.json({
      success: true,
      data: {
        processed: true,
        extracted,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
