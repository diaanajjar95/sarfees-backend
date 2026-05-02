'use client';

import { useActionState, useEffect } from 'react';
import { settleBalanceAction, type SettleResult } from '../actions';

export default function SettleBalanceRow({
  driverId,
  maxAmount,
}: {
  driverId: number;
  maxAmount: number;
}) {
  const action = async (
    prev: SettleResult | null,
    formData: FormData,
  ): Promise<SettleResult> => {
    return settleBalanceAction(driverId, prev, formData);
  };
  const [state, formAction, pending] = useActionState<SettleResult | null, FormData>(
    action,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      // The page revalidates server-side; nothing else to do here.
    }
  }, [state]);

  if (maxAmount <= 0) {
    return (
      <span
        className="text-xs"
        style={{ color: 'var(--color-sarfees-soft)' }}
      >
        Nothing to settle
      </span>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        name="amount"
        type="number"
        step="0.01"
        min={0.01}
        max={maxAmount}
        required
        defaultValue={maxAmount.toFixed(2)}
        className="input-field text-right"
        style={{ maxWidth: 110, padding: '6px 10px' }}
      />
      <input
        name="notes"
        type="text"
        placeholder="ref / notes"
        className="input-field"
        style={{ maxWidth: 130, padding: '6px 10px' }}
      />
      <button
        type="submit"
        className="btn-primary text-xs whitespace-nowrap"
        style={{ padding: '6px 12px' }}
        disabled={pending}
      >
        {pending ? '…' : 'Settle'}
      </button>
      {state?.error && (
        <span
          className="text-[11px]"
          style={{ color: 'var(--color-sarfees-error)' }}
        >
          {state.error}
        </span>
      )}
    </form>
  );
}
