'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';

export interface CreditResult { ok: boolean; error?: string }

export async function creditWalletAction(
  _prev: CreditResult | null,
  formData: FormData,
): Promise<CreditResult> {
  const driverId = Number(formData.get('driverId'));
  const amount = Number(formData.get('amount'));
  const kind = String(formData.get('kind') ?? 'credit');
  const note = String(formData.get('note') ?? '').trim();
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: 'Amount must be greater than 0.' };
  try {
    await apiFetch(`/admin/wallets/${driverId}/credit`, {
      method: 'POST',
      body: { amount, kind, note: note || undefined },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Credit failed.' };
  }
  revalidatePath(`/drivers/${driverId}`);
  return { ok: true };
}
