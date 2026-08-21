'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { loginAction, type LoginResult } from '@/lib/auth';

/** Login per the UX mockup: left-aligned brand, "Welcome back",
 *  remember-me row, amber sign-in, copyright footer. */
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
      <div className="surface-card w-full max-w-md p-10">
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl font-extrabold"
            style={{ backgroundColor: 'var(--color-sarfees-gold-bright)', color: '#1A1A1A' }}
          >
            S
          </div>
          <div>
            <div className="text-lg font-extrabold leading-tight">Sarfees</div>
            <div
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-sarfees-soft)' }}
            >
              Admin Console
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-extrabold">Welcome back</h1>
        <p className="mt-1 mb-8 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
          Sign in to manage the Sarfees network.
        </p>

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

          <div className="flex items-center justify-between pt-1">
            <label
              className="flex cursor-pointer items-center gap-2 text-sm"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              <input type="checkbox" name="remember" className="h-4 w-4 accent-[#FABE2C]" />
              Remember me
            </label>
            <a
              href="mailto:support@sarfees.com?subject=Password%20reset"
              className="text-sm font-semibold underline"
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              Forgot password?
            </a>
          </div>

          {state?.error && (
            <div
              className="rounded-md px-3 py-2 text-sm"
              style={{
                color: 'var(--color-sarfees-error)',
                backgroundColor: 'var(--color-sarfees-error-light)',
                border: '1px solid rgba(198,40,40,0.25)',
              }}
            >
              {state.error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p
          className="mt-7 text-center text-xs"
          style={{ color: 'var(--color-sarfees-soft)' }}
        >
          © 2026 Sarfees. All rights reserved.
        </p>
      </div>
    </div>
  );
}
