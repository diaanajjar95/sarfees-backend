'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createAnnouncementAction, type AnnouncementActionResult } from './actions';

export default function CreateAnnouncementForm() {
  const [state, formAction, pending] = useActionState<
    AnnouncementActionResult | null,
    FormData
  >(createAnnouncementAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="surface-card p-4 space-y-3">
      <div>
        <label className="field-label" htmlFor="title">Title</label>
        <input id="title" name="title" required className="input-field" />
      </div>
      <div>
        <label className="field-label" htmlFor="body">Body</label>
        <textarea
          id="body"
          name="body"
          rows={3}
          required
          className="input-field"
          style={{ resize: 'vertical' }}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="ctaUrl">CTA URL (optional)</label>
        <input id="ctaUrl" name="ctaUrl" type="url" className="input-field" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="startsAt">Starts at</label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            className="input-field"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="endsAt">Ends at</label>
          <input id="endsAt" name="endsAt" type="datetime-local" className="input-field" />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="priority">Priority (higher = first)</label>
        <input
          id="priority"
          name="priority"
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
          Announcement created.
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Publish'}
      </button>
    </form>
  );
}
