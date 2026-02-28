import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse, AppError } from '@/lib/errors';
import { createSignedUploadDescriptor } from '@/lib/media-upload-server';

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(3),
});

function tokenScope(vendorToken: string) {
  if (!vendorToken || vendorToken.length < 3) {
    throw new AppError('INVALID_TOKEN', 'Invalid vendor token', 400);
  }

  return `vendor-${vendorToken}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorToken: string }> }
) {
  try {
    const { vendorToken } = await context.params;
    const input = schema.parse(await request.json());

    const data = await createSignedUploadDescriptor(
      `/api/vendor/${vendorToken}/media/upload`,
      tokenScope(vendorToken),
      input.fileName,
      input.contentType,
    );

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
