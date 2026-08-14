'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';

export interface CancelResult {
  ok: boolean;
  error?: string;
}

/**
 * Ops cancel of a single passenger request. Backend flips the status,
 * stores admin id + reason for audit, and runs the Stage-1 group
 * bookkeeping (same path as a passenger self-cancel).
 */
export async function cancelRequestAction(
  _prev: CancelResult | null,
  formData: FormData,
): Promise<CancelResult> {
  const idRaw = formData.get('requestId');
  const id = idRaw == null ? NaN : Number(idRaw);
  const reason = String(formData.get('reason') ?? '').trim();
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Missing request id.' };
  }
  if (!reason) {
    return { ok: false, error: 'A cancellation reason is required.' };
  }

  try {
    await apiFetch(`/admin/passenger-requests/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to cancel the request.' };
  }
  revalidatePath('/passenger-requests');
  revalidatePath(`/passenger-requests/${id}`);
  return { ok: true };
}
