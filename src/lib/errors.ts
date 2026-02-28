import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/server-observability';

export class AppError extends Error {
  public code: string;
  public status: number;
  public details?: any;

  constructor(code: string, message: string, status: number = 400, details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createErrorResponse(error: any) {
  if (error instanceof AppError || (error?.name === 'AppError' && error?.code && error?.message)) {
    return Response.json(
      { success: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status || 400 }
    );
  }

  if (error?.name === 'ZodError') {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: error.issues ?? error.errors,
        },
      },
      { status: 400 }
    );
  }

  if (error?.code === 'P2002') {
    return Response.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A record with the same unique value already exists',
          details: error.meta,
        },
      },
      { status: 409 }
    );
  }

  if (error?.code === 'P2003') {
    return Response.json(
      {
        success: false,
        error: {
          code: 'RELATION_ERROR',
          message: 'Related record is missing or invalid',
          details: error.meta,
        },
      },
      { status: 400 }
    );
  }

  logger.error('Unhandled API error', {
    code: error?.code,
    message: error?.message,
  });
  void captureServerException(error, {
    tags: { scope: 'api.createErrorResponse' },
  });

  if (process.env.NODE_ENV !== 'production') {
    return Response.json(
      {
        success: false,
        error: {
          code: error?.code || 'INTERNAL_ERROR',
          message: error?.message || 'Unknown server error',
          details: error?.stack || error,
        },
      },
      { status: 500 }
    );
  }

  return Response.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 }
  );
}
