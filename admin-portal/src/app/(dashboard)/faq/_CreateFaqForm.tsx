'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createFaqAction, type FaqActionResult } from './actions';

export default function CreateFaqForm() {
  const [state, formAction, pending] = useActionState<
    FaqActionResult | null,
    FormData
  >(createFaqAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="surface-card p-4 space-y-3"
    >
      <div>
        <label className="field-label" htmlFor="slug">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          required
          placeholder="trip-book"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          title="Lowercase letters, digits, and single hyphens only"
          className="input-field"
        />
        <p
          className="mt-1 text-[10px]"
          style={{ color: 'var(--color-sarfees-soft)' }}
        >
          Stable mobile-side identifier. Lowercase letters, digits, single
          hyphens.
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
          rows={4}
          required
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
          rows={4}
          required
          dir="rtl"
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
          defaultValue={0}
          className="input-field"
        />
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input type="checkbox" name="isActive" defaultChecked />
        <span>Active immediately</span>
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
          FAQ entry created.
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Create FAQ'}
      </button>
    </form>
  );
}
