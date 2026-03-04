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
        let closed = false;
        let interval: ReturnType<typeof setInterval> | null = null;

        const safeEnqueue = (chunk: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closed = true;
          }
        };

        const safeClose = () => {
          if (closed) return;
          closed = true;
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          try {
            controller.close();
          } catch {
          }
        };

        const pushDashboard = async () => {
          if (closed) return;
          const dashboard = await monitoringService.getDashboard(farmId);
          safeEnqueue(serializeEvent('dashboard', dashboard));
        };

        safeEnqueue(': connected\n\n');
        try {
          await pushDashboard();
        } catch {
          safeEnqueue(serializeEvent('error', { message: 'stream_update_failed' }));
        }

        interval = setInterval(() => {
          void pushDashboard().catch(() => {
            safeEnqueue(serializeEvent('error', { message: 'stream_update_failed' }));
          });
        }, 10_000);

        const onAbort = () => {
          request.signal.removeEventListener('abort', onAbort);
          safeClose();
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
