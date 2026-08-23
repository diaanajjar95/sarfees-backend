'use client';

import { useActionState } from 'react';
import { Coins } from 'lucide-react';
import { updateCurrencyAction } from './actions';

interface CurrencyOption {
  code: string;
  symbolEn: string;
  symbolAr: string;
  nameEn: string;
  nameAr: string;
}

export default function CurrencyForm({
  current,
  options,
  readOnly,
}: {
  current: string;
  options: CurrencyOption[];
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateCurrencyAction, null);
  return (
    <form action={formAction} className="surface-card max-w-md space-y-4 p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-sarfees-soft)' }}>
        Platform currency
      </h2>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.code}
            className="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2"
            style={{ borderColor: 'var(--color-sarfees-border)' }}
          >
            <span className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="currencyCode"
                value={o.code}
                defaultChecked={o.code === current}
                disabled={readOnly}
              />
              <span className="font-semibold">{o.nameEn}</span>
              <span style={{ color: 'var(--color-sarfees-soft)' }}>{o.nameAr}</span>
            </span>
            <span className="font-mono text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
              {o.symbolEn} · {o.symbolAr}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>
        Display only — amounts are not converted. Every price, fare, fee,
        and wallet balance is shown in the selected currency across the
        portal and both mobile apps.
      </p>
      {state && !state.ok && (
        <p className="text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{state.error}</p>
      )}
      {state?.ok && <p className="text-xs" style={{ color: '#2E7D32' }}>Currency updated.</p>}
      {!readOnly ? (
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
          <Coins size={15} /> {pending ? 'Saving…' : 'Save currency'}
        </button>
      ) : (
        <p className="text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>Read-only — only the super admin can change it.</p>
      )}
    </form>
  );
}
