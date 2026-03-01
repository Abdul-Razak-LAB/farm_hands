import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { alertPreferencesService } from '@/services/monitoring/alert-preferences-service';

const preferencesSchema = z.object({
  inApp: z.boolean(),
  sms: z.boolean(),
  email: z.boolean(),
  smsRecipients: z.array(z.string()).default([]),
  emailRecipients: z.array(z.string().email()).default([]),
  idempotencyKey: z.string().min(8),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'monitoring:read');
    const { farmId } = await context.params;
    const data = await alertPreferencesService.getPreferences(farmId);
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'monitoring:write');
    const { farmId } = await context.params;
    const userId = getRequestUserId(request);
    const input = preferencesSchema.parse(await request.json());

    const data = await alertPreferencesService.savePreferences({
      farmId,
      userId,
      idempotencyKey: input.idempotencyKey,
      preferences: {
        inApp: input.inApp,
        sms: input.sms,
        email: input.email,
        smsRecipients: input.smsRecipients,
        emailRecipients: input.emailRecipients,
      },
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
