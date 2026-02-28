"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/auth-provider';

type InviteDetails = {
  email: string;
  role: 'OWNER' | 'MANAGER' | 'WORKER';
  farmId: string;
  farmName: string;
};

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const { setFarmId, setRole, setRegistered } = useAuth();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadInvite = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/auth/invite/${params.token}`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || 'Invite link is invalid.');
        }

        if (mounted) {
          setInvite(result.data as InviteDetails);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load invite.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInvite();

    return () => {
      mounted = false;
    };
  }, [params.token]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!invite) {
      setError('Invite details are missing.');
      return;
    }

    if (!fullName.trim() || !password.trim()) {
      setError('Full name and password are required.');
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
      const response = await fetch(`/api/auth/invite/${params.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        const errorCode = result.error?.code;
        if (errorCode === 'EMAIL_IN_USE') {
          router.push(`/login?email=${encodeURIComponent(invite.email)}`);
          return;
        }

        throw new Error(result.error?.message || 'Unable to accept invite.');
      }

      setRegistered(true);
      setFarmId(result.data.farmId);
      setRole(result.data.role);
      router.push('/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to accept invite.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border bg-card p-5 md:p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-black leading-none">Accept Farm Invite</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your account to continue.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading invite...</p>
        ) : invite ? (
          <>
            <div className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
              <p><span className="font-semibold">Farm:</span> {invite.farmName}</p>
              <p><span className="font-semibold">Role:</span> {invite.role}</p>
              <p><span className="font-semibold">Email:</span> {invite.email}</p>
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
                <label htmlFor="password" className="text-sm font-semibold">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                />
              </div>

              {error ? <p className="text-xs text-destructive">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {isSubmitting ? 'Creating account...' : 'Accept invite and create account'}
              </button>
            </form>
          </>
        ) : (
          <>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <p className="mt-3 text-sm text-muted-foreground">Ask your farm admin to resend your invite email.</p>
          </>
        )}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
