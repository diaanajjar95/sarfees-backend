'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { FaqItem } from '@/lib/types';
import type { FaqActionResult } from '../../actions';

interface Props {
  initial: FaqItem;
  action: (
    prev: FaqActionResult | null,
    formData: FormData,
  ) => Promise<FaqActionResult>;
}

export default function EditFaqForm({ initial, action }: Props) {
  const [state, formAction, pending] = useActionState<
    FaqActionResult | null,
    FormData
  >(action, null);

  return (
    <form action={formAction} className="surface-card p-5 space-y-4">
      <div>
        <label className="field-label">Slug</label>
        <input
          value={initial.slug}
          disabled
          className="input-field opacity-60"
        />
        <p
          className="mt-1 text-[10px]"
          style={{ color: 'var(--color-sarfees-soft)' }}
        >
          Slug is immutable to keep mobile deep links stable.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="categoryEn">
            Category (EN)
          </label>
          <input
            id="categoryEn"
            name="categoryEn"
            required
            defaultValue={initial.categoryEn}
            className="input-field"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="categoryAr">
            Category (AR)
          </label>
          <input
            id="categoryAr"
            name="categoryAr"
            required
            dir="rtl"
            defaultValue={initial.categoryAr}
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="questionEn">
          Question (EN)
        </label>
        <input
          id="questionEn"
          name="questionEn"
          required
          defaultValue={initial.questionEn}
          className="input-field"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="questionAr">
          Question (AR)
        </label>
        <input
          id="questionAr"
          name="questionAr"
          required
          dir="rtl"
          defaultValue={initial.questionAr}
          className="input-field"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="answerEn">
          Answer (EN)
        </label>
        <textarea
          id="answerEn"
          name="answerEn"
          rows={6}
          required
          defaultValue={initial.answerEn}
          className="input-field"
          style={{ resize: 'vertical' }}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="answerAr">
          Answer (AR)
        </label>
        <textarea
          id="answerAr"
          name="answerAr"
          rows={6}
          required
          dir="rtl"
          defaultValue={initial.answerAr}
          className="input-field"
          style={{ resize: 'vertical' }}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="displayOrder">
          Display order (lower = first)
        </label>
        <input
          id="displayOrder"
          name="displayOrder"
          type="number"
          defaultValue={initial.displayOrder}
          className="input-field"
        />
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial.isActive}
        />
        <span>Active</span>
      </label>

      {state?.error && (
        <div
          className="rounded-md px-3 py-2 text-xs"
          style={{
            color: 'var(--color-sarfees-error)',
            backgroundColor: 'rgba(198,40,40,0.08)',
            border: '1px solid rgba(198,40,40,0.25)',
          }}
        >
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div
          className="rounded-md px-3 py-2 text-xs"
          style={{
            color: '#2E7D32',
            backgroundColor: 'rgba(46,125,50,0.08)',
            border: '1px solid rgba(46,125,50,0.25)',
          }}
        >
          Saved.
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <Link href="/faq" className="btn-secondary inline-flex items-center">
          Cancel
        </Link>
      </div>
    </form>
  );
}
