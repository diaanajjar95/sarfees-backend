'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';

export interface CancelResult {
  ok: boolean;
  error?: string;
}

/**
 * Ops cancel of a package delivery. Backend records admin id + reason
 * and closes the trip group when this was its last live member.
 */
export async function cancelPackageAction(
  _prev: CancelResult | null,
  formData: FormData,
): Promise<CancelResult> {
  const idRaw = formData.get('packageId');
  const id = idRaw == null ? NaN : Number(idRaw);
  const reason = String(formData.get('reason') ?? '').trim();
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Missing package id.' };
  }
  if (!reason) {
    return { ok: false, error: 'A cancellation reason is required.' };
  }

  try {
    await apiFetch(`/admin/packages/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to cancel the delivery.' };
  }
  revalidatePath('/packages');
  return { ok: true };
}
