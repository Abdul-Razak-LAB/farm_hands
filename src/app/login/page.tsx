"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/layout/auth-provider';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { setFarmId, setRole, setRegistered } = useAuth();

  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json')
        ? await response.json()
        : { success: false, error: { message: 'Server returned a non-JSON response. Check /api/auth/login route.' } };

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to sign in');
      }

      setRegistered(true);
      setFarmId(result.data.farmId);
      setRole(result.data.role);
      router.push('/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border bg-card p-5 md:p-6 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="mt-1 h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-black">
            F
          </div>
          <div>
            <h1 className="text-2xl font-black leading-none">FarmOSP</h1>
            <p className="text-sm text-muted-foreground mt-1">Welcome back. Sign in to continue.</p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-semibold">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-semibold">Password</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 pr-11 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-muted-foreground"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-primary">Create account</Link>
        </p>
      </div>
    </div>
  );
}
