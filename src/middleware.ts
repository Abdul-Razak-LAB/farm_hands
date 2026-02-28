import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 1. Security Headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none';"
  );

  // 2. Auth Check (Simplistic version for brevity)
  // In production, use session token validation against DB/Redis
  const sessionToken = request.cookies.get('session_token')?.value;
  const isAuthRoute = request.nextUrl.pathname.startsWith('/api/auth');
  const isAuthMutation = request.nextUrl.pathname === '/api/auth/login' || request.nextUrl.pathname === '/api/auth/signup';
  const isPublicRoute = request.nextUrl.pathname === '/';
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  const farmMatch = request.nextUrl.pathname.match(/^\/api\/farms\/([^/]+)/);
  const farmId = farmMatch?.[1];
  const userId = request.headers.get('x-user-id') || undefined;

  if (isAuthMutation || (isStateChanging && request.nextUrl.pathname.startsWith('/api'))) {
    const rate = await checkRateLimit({
      request,
      profile: isAuthMutation ? 'auth' : 'write',
      userId,
      farmId,
    });

    if (rate.limited) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please retry later.',
            details: { retryAfterSeconds: rate.retryAfterSeconds },
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rate.retryAfterSeconds),
          },
        }
      );
    }
  }

  if (!sessionToken && !isAuthRoute && !isPublicRoute && request.nextUrl.pathname.startsWith('/api')) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Auth required' } },
      { status: 401 }
    );
  }

  if (isStateChanging && request.nextUrl.pathname.startsWith('/api')) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return Response.json(
          { success: false, error: { code: 'FORBIDDEN_ORIGIN', message: 'Invalid request origin' } },
          { status: 403 }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
