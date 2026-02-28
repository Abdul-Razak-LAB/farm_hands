import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { requirePermission } from '@/lib/permissions';
import { createSignedUploadDescriptor } from '@/lib/media-upload-server';

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(3),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    requirePermission(request, 'updates:write');
    const { farmId } = await context.params;
    const input = schema.parse(await request.json());

    const data = await createSignedUploadDescriptor(
      `/api/farms/${farmId}/media/upload`,
      farmId,
      input.fileName,
      input.contentType,
    );

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
