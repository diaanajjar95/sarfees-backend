'use client';

import { useActionState } from 'react';
import { Save } from 'lucide-react';
import { updateWalletConfigAction } from './actions';

export default function SettingsForm({
  commissionPercent,
  lowBalanceThresholdJod,
  readOnly,
}: {
  commissionPercent: number;
  lowBalanceThresholdJod: number;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateWalletConfigAction, null);
  return (
    <form action={formAction} className="surface-card max-w-md space-y-4 p-6">
      <div>
        <label className="field-label">Commission (% of trip total)</label>
        <input name="commissionPercent" type="number" min={0} max={100} step={0.5} defaultValue={commissionPercent} disabled={readOnly} required className="input-field" />
        <p className="mt-1 text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>
          Applies to trips created after the change — existing trips keep
          the rate they were booked with.
        </p>
      </div>
      <div>
        <label className="field-label">Low-balance warning threshold (JD)</label>
        <input name="lowBalanceThresholdJod" type="number" min={0} max={1000} step={0.5} defaultValue={lowBalanceThresholdJod} disabled={readOnly} required className="input-field" />
      </div>
      {state && !state.ok && (
        <p className="text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-xs" style={{ color: '#2E7D32' }}>Saved.</p>
      )}
      {!readOnly && (
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
          <Save size={15} /> {pending ? 'Saving…' : 'Save settings'}
        </button>
      )}
      {readOnly && (
        <p className="text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>Read-only — only the super admin can edit.</p>
      )}
    </form>
  );
}
