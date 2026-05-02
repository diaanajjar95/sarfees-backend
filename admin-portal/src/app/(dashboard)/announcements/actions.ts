'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';
import type { Announcement, CreateAnnouncementPayload } from '@/lib/types';

export interface AnnouncementActionResult {
  ok: boolean;
  error?: string;
}

function str(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

function num(v: FormDataEntryValue | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function createAnnouncementAction(
  _prev: AnnouncementActionResult | null,
  formData: FormData,
): Promise<AnnouncementActionResult> {
  const title = str(formData.get('title'));
  const body = str(formData.get('body'));
  if (!title || !body) {
    return { ok: false, error: 'Title and body are required.' };
  }
  const payload: CreateAnnouncementPayload = {
    title,
    body,
    ctaUrl: str(formData.get('ctaUrl')),
    isActive: formData.get('isActive') === 'on',
    priority: num(formData.get('priority')) ?? 0,
    startsAt: str(formData.get('startsAt')),
    endsAt: str(formData.get('endsAt')),
  };

  try {
    await apiFetch<Announcement>('/admin/announcements', {
      method: 'POST',
      body: payload,
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to create announcement.' };
  }
  revalidatePath('/announcements');
  return { ok: true };
}

export async function toggleAnnouncementAction(
  id: number,
  isActive: boolean,
): Promise<void> {
  await apiFetch<Announcement>(`/admin/announcements/${id}`, {
    method: 'PATCH',
    body: { isActive },
  });
  revalidatePath('/announcements');
}

export async function deleteAnnouncementAction(id: number): Promise<void> {
  await apiFetch<{ id: number }>(`/admin/announcements/${id}`, {
    method: 'DELETE',
  });
  revalidatePath('/announcements');
}
