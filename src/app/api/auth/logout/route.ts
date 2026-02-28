import { prisma } from '@/lib/prisma';
import { createErrorResponse } from '@/lib/errors';
import { hashSessionToken } from '@/lib/session-token';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const tokenPart = cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('session_token='));

    const rawToken = tokenPart?.split('=')[1];
    if (rawToken) {
      const tokenHash = hashSessionToken(decodeURIComponent(rawToken));
      await prisma.session.deleteMany({ where: { token: tokenHash } });
    }

    const response = Response.json({ success: true, data: { loggedOut: true } });
    response.headers.append(
      'Set-Cookie',
      [
        'session_token=',
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        process.env.NODE_ENV === 'production' ? 'Secure' : '',
      ]
        .filter(Boolean)
        .join('; '),
    );

    return response;
  } catch (error) {
    return createErrorResponse(error);
  }
}
