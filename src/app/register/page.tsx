"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/auth-provider';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function RegisterPage() {
  const router = useRouter();
  const { setFarmId, setRole, setRegistered } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [installMessage, setInstallMessage] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setInstallMessage('');
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    setInstallMessage('');

    if (!deferredPrompt) {
      setInstallMessage('Install is not available yet. Open browser menu and choose Install app/Add to Home Screen.');
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setShowInstallBanner(false);
    }

    setDeferredPrompt(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Full name, email, and password are required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json')
        ? await response.json()
        : { success: false, error: { message: 'Server returned a non-JSON response. Check /api/auth/signup route.' } };

      if (!result.success) {
        const errorCode = result.error?.code;
        const errorMessage = String(result.error?.message || '').toLowerCase();
        const shouldRedirectToLogin =
          errorCode === 'EMAIL_IN_USE' ||
          errorCode === 'CONFLICT' ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('email in use');

        if (shouldRedirectToLogin) {
          setRegistered(true);
          router.push(`/login?email=${encodeURIComponent(email.trim())}`);
          return;
        }
        throw new Error(result.error?.message || 'Failed to create account');
      }

      setRegistered(true);
      setFarmId(result.data.farmId);
      setRole(result.data.role);
      router.push('/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create account');
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
            <p className="text-sm text-muted-foreground mt-1">Get started with FarmOSP today</p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <label htmlFor="fullName" className="text-sm font-semibold">Full Name</label>
            <input
              id="fullName"
              name="fullName"
              placeholder="John Doe"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

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
            <label htmlFor="phone" className="text-sm font-semibold">Phone (Optional)</label>
            <input
              id="phone"
              name="phone"
              placeholder="0241234567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm</label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 w-full rounded-md border bg-background px-3 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-muted-foreground"
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary">Sign In</Link>
        </p>
      </div>

      {showInstallBanner ? (
      <div className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border bg-card px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">Install FarmOSP</p>
            <p className="text-xs text-muted-foreground">Save this workspace as an app for faster field access.</p>
            {installMessage ? <p className="mt-1 text-xs text-muted-foreground">{installMessage}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void installApp()}
              className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Install
            </button>
            <button
              type="button"
              onClick={() => setShowInstallBanner(false)}
              className="h-9 rounded-md border px-4 text-sm font-semibold"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
      ) : null}
    </div>
  );
}
