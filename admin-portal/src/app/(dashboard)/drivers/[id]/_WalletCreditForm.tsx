'use client';

import { useActionState } from 'react';
import { Wallet } from 'lucide-react';
import { creditWalletAction } from './wallet-actions';

export default function WalletCreditForm({ driverId, currency }: { driverId: number; currency: string }) {
  const [state, formAction, pending] = useActionState(creditWalletAction, null);
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="driverId" value={driverId} />
      <div>
        <label className="field-label">Amount ({currency})</label>
        <input name="amount" type="number" min={0.5} step={0.5} required className="input-field w-28" />
      </div>
      <div>
        <label className="field-label">Type</label>
        <select name="kind" className="input-field w-32">
          <option value="credit">Credit</option>
          <option value="refund">Refund</option>
        </select>
      </div>
      <div className="min-w-40 flex-1">
        <label className="field-label">Note (optional)</label>
        <input name="note" maxLength={200} className="input-field" placeholder="reason / reference" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
        <Wallet size={15} /> {pending ? 'Applying…' : 'Add to wallet'}
      </button>
      {state && !state.ok && (
        <p className="w-full text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{state.error}</p>
      )}
      {state?.ok && (
        <p className="w-full text-xs" style={{ color: '#2E7D32' }}>Wallet credited.</p>
      )}
    </form>
  );
}
