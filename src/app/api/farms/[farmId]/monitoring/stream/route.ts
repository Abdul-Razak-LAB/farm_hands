import { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/errors';
import { requirePermission } from '@/lib/permissions';
import { monitoringService } from '@/services/monitoring/monitoring-service';

export const dynamic = 'force-dynamic';

function serializeEvent(type: string, payload: unknown) {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'monitoring:read');
    const { farmId } = await context.params;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();

        const pushDashboard = async () => {
          const dashboard = await monitoringService.getDashboard(farmId);
          controller.enqueue(encoder.encode(serializeEvent('dashboard', dashboard)));
        };

        controller.enqueue(encoder.encode(': connected\n\n'));
        await pushDashboard();

        const interval = setInterval(() => {
          void pushDashboard().catch(() => {
            controller.enqueue(encoder.encode(serializeEvent('error', { message: 'stream_update_failed' })));
          });
        }, 10_000);

        const onAbort = () => {
          clearInterval(interval);
          controller.close();
        };

        request.signal.addEventListener('abort', onAbort, { once: true });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
