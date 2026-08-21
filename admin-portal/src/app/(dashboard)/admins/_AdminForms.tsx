'use client';

import { useActionState, useTransition } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import {
  createAdminAction,
  toggleAdminActiveAction,
} from './actions';

const ROLE_OPTIONS = [
  { value: 'seller', label: 'Seller (card distributor)' },
  { value: 'support', label: 'Support' },
  { value: 'ops_manager', label: 'Ops manager' },
  { value: 'finance', label: 'Finance' },
  { value: 'super_admin', label: 'Super admin' },
];

export function CreateAdminForm() {
  const [state, formAction, pending] = useActionState(createAdminAction, null);

  return (
    <div className="surface-card p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-sarfees-soft)' }}>
        Create account
      </h2>
      <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Email</label>
          <input name="email" type="email" required className="input-field" placeholder="seller2@sarfees.com" />
        </div>
        <div>
          <label className="field-label">Full name / shop name</label>
          <input name="fullName" required minLength={2} className="input-field" placeholder="Cards Shop — Downtown" />
        </div>
        <div>
          <label className="field-label">Role</label>
          <select name="role" defaultValue="seller" className="input-field">
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Temporary password</label>
          <input name="tempPassword" required minLength={8} className="input-field font-mono" autoComplete="off" placeholder="min 8 chars — changed on first login" />
        </div>
        {state && !state.ok && (
          <p className="sm:col-span-2 text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{state.error}</p>
        )}
        {state?.ok && (
          <div className="sm:col-span-2 rounded-lg p-3 text-sm" style={{ background: 'var(--color-sarfees-gold-surface)', border: '1px solid var(--color-sarfees-gold-light)' }}>
            <div className="flex items-center gap-2 font-bold"><KeyRound size={14} /> Hand these over now — shown once</div>
            <div className="mt-1 font-mono text-xs">
              {state.email} / {state.tempPassword}
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
              They must change the password on first login.
            </p>
          </div>
        )}
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
            <UserPlus size={15} /> {pending ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ToggleActiveButton({ id, isActive }: { id: number; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => { void toggleAdminActiveAction(id, !isActive); })}
      disabled={pending}
      className="rounded px-2 py-1 text-xs font-bold disabled:opacity-50"
      style={{
        color: isActive ? 'var(--color-sarfees-error)' : '#2E7D32',
        border: `1px solid ${isActive ? 'var(--color-sarfees-error)' : '#2E7D32'}44`,
      }}
    >
      {pending ? '…' : isActive ? 'Deactivate' : 'Activate'}
    </button>
  );
}
