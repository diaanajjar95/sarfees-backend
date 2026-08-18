'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';

export interface ActionResult {
  ok: boolean;
  error?: string;
  info?: string;
}

export async function createTopicAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (name.length < 3) return { ok: false, error: 'Topic name too short.' };
  try {
    await apiFetch('/admin/notification-topics', {
      method: 'POST',
      body: { name, description: description || undefined },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not create topic.' };
  }
  revalidatePath('/notifications');
  return { ok: true, info: `Topic '${name}' created.` };
}

export async function broadcastAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const topic = String(formData.get('topic') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!topic) return { ok: false, error: 'Pick a topic.' };
  if (title.length < 2 || body.length < 2)
    return { ok: false, error: 'Title and message are required.' };
  try {
    await apiFetch('/admin/notification-topics/broadcast', {
      method: 'POST',
      body: { topic, title, body },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Broadcast failed.' };
  }
  return { ok: true, info: `Sent to '${topic}'.` };
}
