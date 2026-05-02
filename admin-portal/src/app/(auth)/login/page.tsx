'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { loginAction, type LoginResult } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(
    loginAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.push(state.mustChangePassword ? '/change-password' : '/');
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="surface-card w-full max-w-md p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-extrabold"
            style={{ backgroundColor: 'var(--color-sarfees-gold)', color: '#1A1A1A' }}
          >
            S
          </div>
          <h1 className="text-2xl font-extrabold">Sarfees Admin</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
            Sign in to the operations console
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input-field"
              placeholder="admin@sarfees.com"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              className="input-field"
              placeholder="••••••••"
            />
          </div>
          {state?.error && (
            <div
              className="rounded-md px-3 py-2 text-sm"
              style={{
                color: 'var(--color-sarfees-error)',
                backgroundColor: 'rgba(198,40,40,0.08)',
                border: '1px solid rgba(198,40,40,0.25)',
              }}
            >
              {state.error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
