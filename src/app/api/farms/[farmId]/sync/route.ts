import { NextRequest } from 'next/server';
import { syncService } from '@/services/sync/sync-service';
import type { SyncEvent } from '@/services/sync/sync-service';
import { createErrorResponse } from '@/lib/errors';
import { z } from 'zod';

const MAX_SYNC_BATCH = 100;
const MAX_PAGE_SIZE = 200;

const syncSchema = z.object({
  deviceId: z.string().min(1).optional(),
  events: z.array(z.object({
    type: z.string(),
    payload: z.any(),
    idempotencyKey: z.string(),
  })).max(MAX_SYNC_BATCH),
});

const cursorSchema = z.string().nullable();
const pageSizeSchema = z.coerce.number().int().positive().max(MAX_PAGE_SIZE).optional();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    const { farmId } = await context.params;
    const body = await request.json();
    const { events, deviceId } = syncSchema.parse(body);
    
    // In a real app, userId would come from the session context
    const userId = 'user_id_from_session';

    const normalizedEvents: SyncEvent[] = events.map((event) => ({
      type: event.type,
      payload: event.payload,
      idempotencyKey: event.idempotencyKey,
      userId,
      deviceId,
    }));

    const results = await syncService.processBatch(farmId, normalizedEvents);

    return Response.json({ success: true, data: { results } });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> }
) {
  try {
    const { farmId } = await context.params;
    const rawCursor = request.nextUrl.searchParams.get('cursor');
    const cursor = cursorSchema.parse(rawCursor);
    const limit = pageSizeSchema.parse(request.nextUrl.searchParams.get('limit') ?? undefined) ?? 100;

    const data = await syncService.getIncrementalDelta(farmId, cursor, limit);

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
