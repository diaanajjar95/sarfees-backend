'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { suspendDriverAction } from '../drivers/actions';

/**
 * Suspension categories mirror the backend enum. The category decides
 * which suspended-state card the driver's app renders (documents /
 * rating / payment / violation blocks on home-summary.suspensionInfo),
 * and the reason text is shown to the driver verbatim.
 */
const CATEGORIES = [
  { value: 'documents', label: 'Documents — paperwork lapse (expired registration / insurance…)' },
  { value: 'rating', label: 'Rating — dropped below the platform minimum' },
  { value: 'payment', label: 'Payment — outstanding commission overdue' },
  { value: 'violation', label: 'Violation — safety / conduct report under review' },
];

interface Props {
  driverId: number;
  /** True while the driver is on_trip — suspension blocked. */
  disabled?: boolean;
}

export default function SuspendWithReason({ driverId, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(suspendDriverAction, null);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="btn-danger"
      >
        {disabled ? 'Cannot suspend (on trip)' : 'Suspend'}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-xl border p-3 w-full max-w-md"
      style={{ borderColor: '#C62828', background: 'rgba(198,40,40,0.06)' }}
    >
      <input type="hidden" name="driverId" value={driverId} />
      <div className="text-sm font-bold" style={{ color: '#EF5350' }}>
        Suspend this driver?
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
        The driver is blocked from going online immediately. The category
        picks which card their app shows; the reason is visible to them
        word-for-word.
      </p>
      <select
        name="category"
        required
        defaultValue=""
        className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: 'var(--color-sarfees-border)' }}
      >
        <option value="" disabled>
          Suspension category…
        </option>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <textarea
        name="reason"
        required
        maxLength={500}
        rows={2}
        placeholder="Reason (required — the driver sees this)…"
        className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: 'var(--color-sarfees-border)' }}
      />
      {state?.error && (
        <div className="mt-2 text-xs" style={{ color: '#EF5350' }}>
          {state.error}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: '#C62828' }}
        >
          <ShieldAlert size={15} />
          {pending ? 'Suspending…' : 'Confirm suspension'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--color-sarfees-border)' }}
        >
          Keep active
        </button>
      </div>
    </form>
  );
}
