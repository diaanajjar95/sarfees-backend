'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { changePasswordAction, type ChangePasswordResult } from '@/lib/auth';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ChangePasswordResult | null,
    FormData
  >(changePasswordAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.push('/login');
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="surface-card w-full max-w-md p-8 shadow-2xl">
        <h1 className="text-xl font-extrabold">Change your password</h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--color-sarfees-muted)' }}
        >
          Your password is set to a temporary value. Choose a new one to continue.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label className="field-label" htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="newPassword">New password (min 8)</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="input-field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="input-field"
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
            {pending ? 'Saving…' : 'Save and sign in again'}
          </button>
        </form>
      </div>
    </div>
  );
}
