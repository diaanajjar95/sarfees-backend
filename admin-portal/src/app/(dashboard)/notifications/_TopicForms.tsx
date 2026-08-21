'use client';

import { useActionState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import {
  broadcastAction,
  createTopicAction,
  type ActionResult,
} from './actions';

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p
      className="mt-2 text-xs"
      style={{ color: state.ok ? '#4CAF50' : '#EF5350' }}
    >
      {state.ok ? state.info : state.error}
    </p>
  );
}

export function BroadcastForm({ topics }: { topics: string[] }) {
  const [state, formAction, pending] = useActionState(broadcastAction, null);
  return (
    <form action={formAction} className="surface-card p-5">
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-gold)' }}
      >
        Send broadcast
      </h2>
      <p className="mt-1 text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
        Push notification to every device subscribed to the topic. Requires
        Firebase credentials to be configured.
      </p>
      <select
        name="topic"
        required
        defaultValue=""
        className="mt-3 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: 'var(--color-sarfees-border)' }}
      >
        <option value="" disabled>
          Topic…
        </option>
        {topics.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        name="title"
        required
        maxLength={120}
        placeholder="Title"
        className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: 'var(--color-sarfees-border)' }}
      />
      <textarea
        name="body"
        required
        maxLength={500}
        rows={3}
        placeholder="Message"
        className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: 'var(--color-sarfees-border)' }}
      />
      <button
        type="submit"
        disabled={pending}
        className="btn-primary mt-3 inline-flex items-center gap-2 disabled:opacity-60"
      >
        <Megaphone size={15} /> {pending ? 'Sending…' : 'Send broadcast'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CreateTopicForm() {
  const [state, formAction, pending] = useActionState(createTopicAction, null);
  return (
    <form action={formAction} className="surface-card p-5">
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-gold)' }}
      >
        New topic
      </h2>
      <input
        name="name"
        required
        maxLength={64}
        pattern="[a-zA-Z0-9_\-]+"
        placeholder="topic_name (letters, digits, _ , -)"
        className="mt-3 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: 'var(--color-sarfees-border)' }}
      />
      <input
        name="description"
        maxLength={200}
        placeholder="Description (optional)"
        className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: 'var(--color-sarfees-border)' }}
      />
      <button
        type="submit"
        disabled={pending}
        className="btn-secondary mt-3 inline-flex items-center gap-2 disabled:opacity-60"
      >
        <Plus size={15} /> {pending ? 'Creating…' : 'Create topic'}
      </button>
      <Feedback state={state} />
    </form>
  );
}
