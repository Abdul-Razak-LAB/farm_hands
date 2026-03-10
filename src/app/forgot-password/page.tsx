"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewLink, setPreviewLink] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setPreviewLink('');

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Unable to submit reset request.');
      }

      setMessage(result.data?.message || 'If an account exists for this email, a reset link has been sent.');
      if (result.data?.previewResetLink) {
        setPreviewLink(result.data.previewResetLink as string);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit reset request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border bg-card p-5 md:p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-black leading-none">Forgot password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Request a reset link for your owner, manager, or worker account.
          </p>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-semibold">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="name@example.com"
            />
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
          {previewLink ? (
            <p className="rounded-md border bg-muted/40 p-2 text-xs break-all">
              Dev reset link: <a href={previewLink} className="font-semibold underline">{previewLink}</a>
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting ? 'Sending link...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Remembered your password?{' '}
          <Link href="/login" className="font-semibold text-primary">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
