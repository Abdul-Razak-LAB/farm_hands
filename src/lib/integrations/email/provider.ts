import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

const sentInWindow = new Map<string, { count: number; resetAt: number }>();

function checkQuota(recipient: string) {
  const now = Date.now();
  const current = sentInWindow.get(recipient);
  const resetAt = now + 60_000;

  if (!current || current.resetAt <= now) {
    sentInWindow.set(recipient, { count: 1, resetAt });
    return;
  }

  if (current.count >= 10) {
    throw new AppError('EMAIL_RATE_LIMITED', 'Too many emails for recipient in current window', 429);
  }

  sentInWindow.set(recipient, { count: current.count + 1, resetAt: current.resetAt });
}

export async function sendEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('Email provider not configured; skipping email send', {
      to: message.to,
      subject: message.subject,
    });
    return { queued: false, skipped: true };
  }

  checkQuota(message.to);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: message.from || 'FarmOps <no-reply@farmops.local>',
      to: [message.to],
      subject: message.subject,
      html: message.html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new AppError('EMAIL_SEND_FAILED', 'Failed to send email', 502, { payload });
  }

  return { queued: true, skipped: false };
}
