'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';

interface CancelResult {
  ok: boolean;
  error?: string;
}

interface Props {
  /** Server action: (prev, formData) → { ok, error? } */
  action: (prev: CancelResult | null, formData: FormData) => Promise<CancelResult>;
  /** Hidden field name the action expects (e.g. "tripId" / "requestId"). */
  idFieldName: string;
  id: number;
  /** Button label, e.g. "Cancel trip" / "Cancel request". */
  label: string;
  /** One-line consequence description shown inside the dialog. */
  consequence: string;
}

/**
 * Destructive-action button + inline confirm panel with a mandatory
 * reason textarea. Used for ops cancellation of trips and passenger
 * requests. Keeps everything client-side simple: open → type reason →
 * confirm fires the server action → refresh on success.
 */
export default function CancelWithReason({
  action,
  idFieldName,
  id,
  label,
  consequence,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

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
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold"
        style={{ borderColor: '#C62828', color: '#EF5350' }}
      >
        <XCircle size={15} /> {label}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-xl border p-3 w-full max-w-md"
      style={{ borderColor: '#C62828', background: 'rgba(198,40,40,0.06)' }}
    >
      <input type="hidden" name={idFieldName} value={id} />
      <div className="text-sm font-bold" style={{ color: '#EF5350' }}>
        {label}?
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
        {consequence}
      </p>
      <textarea
        name="reason"
        required
        maxLength={500}
        rows={2}
        placeholder="Reason (required, shown in the audit trail)…"
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
          className="rounded-lg px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: '#C62828' }}
        >
          {pending ? 'Cancelling…' : 'Confirm cancellation'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--color-sarfees-border)' }}
        >
          Keep it
        </button>
      </div>
    </form>
  );
}
