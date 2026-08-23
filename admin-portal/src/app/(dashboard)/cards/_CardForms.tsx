'use client';

import { useActionState, useState } from 'react';
import { CreditCard, Printer } from 'lucide-react';
import { generateBatchAction, type BatchResult } from './actions';

export function GenerateBatchForm({ currency }: { currency: string }) {
  const [state, formAction, pending] = useActionState(generateBatchAction, null);
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    if (!state?.codes) return;
    const pretty = state.codes
      .map((c) => c.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3'))
      .join('\n');
    void navigator.clipboard.writeText(pretty);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="surface-card p-5">
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-gold)' }}
      >
        Generate a card batch
      </h2>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
        Codes are shown ONCE below — copy or print them before leaving the
        page. They are masked everywhere afterwards.
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">Card value ({currency})</label>
          <input name="amount" type="number" min={1} max={500} step={1} defaultValue={10} required className="input-field w-32" />
        </div>
        <div>
          <label className="field-label">How many</label>
          <input name="count" type="number" min={1} max={1000} step={1} defaultValue={20} required className="input-field w-32" />
        </div>
        <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
          <CreditCard size={15} /> {pending ? 'Generating…' : 'Generate'}
        </button>
      </form>
      {state && !state.ok && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{state.error}</p>
      )}
      {state?.ok && state.codes && (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--color-sarfees-gold-light)', background: 'var(--color-sarfees-gold-surface)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">
              {state.codes.length} × {state.amount} {currency} — batch {state.batchId?.slice(0, 8)}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={copyAll} className="btn-secondary px-3 py-1.5 text-xs">
                {copied ? 'Copied!' : 'Copy all'}
              </button>
              <button type="button" onClick={() => window.print()} className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs">
                <Printer size={13} /> Print
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-3">
            {state.codes.map((c) => (
              <span key={c}>{c.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3')}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
