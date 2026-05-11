'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';
import type {
  CreateFaqItemPayload,
  FaqItem,
  UpdateFaqItemPayload,
} from '@/lib/types';

export interface FaqActionResult {
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

export async function createFaqAction(
  _prev: FaqActionResult | null,
  formData: FormData,
): Promise<FaqActionResult> {
  const slug = str(formData.get('slug'));
  const categoryEn = str(formData.get('categoryEn'));
  const categoryAr = str(formData.get('categoryAr'));
  const questionEn = str(formData.get('questionEn'));
  const questionAr = str(formData.get('questionAr'));
  const answerEn = str(formData.get('answerEn'));
  const answerAr = str(formData.get('answerAr'));

  if (
    !slug ||
    !categoryEn ||
    !categoryAr ||
    !questionEn ||
    !questionAr ||
    !answerEn ||
    !answerAr
  ) {
    return { ok: false, error: 'All fields are required.' };
  }

  const payload: CreateFaqItemPayload = {
    slug,
    categoryEn,
    categoryAr,
    questionEn,
    questionAr,
    answerEn,
    answerAr,
    displayOrder: num(formData.get('displayOrder')) ?? 0,
    isActive: formData.get('isActive') === 'on',
  };

  try {
    await apiFetch<FaqItem>('/admin/faq', { method: 'POST', body: payload });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to create FAQ entry.' };
  }
  revalidatePath('/faq');
  return { ok: true };
}

export async function updateFaqAction(
  id: number,
  _prev: FaqActionResult | null,
  formData: FormData,
): Promise<FaqActionResult> {
  const payload: UpdateFaqItemPayload = {
    categoryEn: str(formData.get('categoryEn')),
    categoryAr: str(formData.get('categoryAr')),
    questionEn: str(formData.get('questionEn')),
    questionAr: str(formData.get('questionAr')),
    answerEn: str(formData.get('answerEn')),
    answerAr: str(formData.get('answerAr')),
    displayOrder: num(formData.get('displayOrder')),
    isActive: formData.get('isActive') === 'on',
  };

  try {
    await apiFetch<FaqItem>(`/admin/faq/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to update FAQ entry.' };
  }
  revalidatePath('/faq');
  revalidatePath(`/faq/${id}/edit`);
  return { ok: true };
}

export async function toggleFaqAction(
  id: number,
  isActive: boolean,
): Promise<void> {
  await apiFetch<FaqItem>(`/admin/faq/${id}`, {
    method: 'PATCH',
    body: { isActive },
  });
  revalidatePath('/faq');
}

export async function deleteFaqAction(id: number): Promise<void> {
  await apiFetch<{ id: number }>(`/admin/faq/${id}`, { method: 'DELETE' });
  revalidatePath('/faq');
}
