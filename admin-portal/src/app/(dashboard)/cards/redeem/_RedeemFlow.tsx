'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, HandCoins, Search } from 'lucide-react';
import {
  lookupDriverAction,
  redeemCardAction,
  type RedeemResult,
} from '../actions';

/** Two-step redeem, telecom-shop style: phone → confirm name → code → done. */
export default function RedeemFlow() {
  const [phone, setPhone] = useState('');
  const [lookup, lookupAction, lookingUp] = useActionState(lookupDriverAction, null);
  const [redeem, redeemAction, redeeming] = useActionState(redeemCardAction, null);

  const confirmed = lookup?.ok && lookup.step === 'confirmed';
  const done = redeem?.ok && redeem.step === 'done';

  if (done) {
    return (
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <CheckCircle2 size={44} className="mx-auto" style={{ color: '#2E7D32' }} />
        <h2 className="mt-3 text-xl font-extrabold">
          {redeem.amount?.toFixed(2)} JD added
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
          {redeem.driverName}&apos;s wallet was topped up. They received a
          notification.
        </p>
        <a href="/cards/redeem" className="btn-primary mt-5 inline-block">
          Redeem another
        </a>
      </div>
    );
  }

  return (
    <div className="surface-card mx-auto max-w-md p-6">
      <form action={lookupAction} className="space-y-3">
        <div>
          <label className="field-label">Driver mobile number</label>
          <input
            name="driverPhone"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="770000001"
            required
            className="input-field font-mono"
            inputMode="numeric"
          />
        </div>
        {!confirmed && (
          <button type="submit" disabled={lookingUp} className="btn-secondary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60">
            <Search size={15} /> {lookingUp ? 'Checking…' : 'Find driver'}
          </button>
        )}
        {lookup && !lookup.ok && (
          <p className="text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{lookup.error}</p>
        )}
      </form>

      {confirmed && (
        <form action={redeemAction} className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: 'var(--color-sarfees-border)' }}>
          <input type="hidden" name="driverPhone" value={phone} />
          <div className="rounded-lg px-3 py-2 text-sm font-bold" style={{ background: 'var(--color-sarfees-gold-surface)', border: '1px solid var(--color-sarfees-gold-light)' }}>
            Driver: {lookup.driverName}
          </div>
          <div>
            <label className="field-label">Card code</label>
            <input name="code" placeholder="1234-5678-9012" required className="input-field font-mono" autoComplete="off" />
          </div>
          {redeem && !redeem.ok && (
            <p className="text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{redeem.error}</p>
          )}
          <button type="submit" disabled={redeeming} className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60">
            <HandCoins size={15} /> {redeeming ? 'Redeeming…' : 'Redeem onto wallet'}
          </button>
        </form>
      )}
    </div>
  );
}
