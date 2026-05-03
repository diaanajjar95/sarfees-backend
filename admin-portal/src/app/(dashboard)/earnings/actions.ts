'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';
import type { SettleBalanceResponse } from '@/lib/types';

export interface SettleResult {
  ok: boolean;
  error?: string;
  amountSettled?: number;
  newBalance?: number;
}

export async function settleBalanceAction(
  driverId: number,
  _prev: SettleResult | null,
  formData: FormData,
): Promise<SettleResult> {
  const amount = Number(formData.get('amount'));
  const notes = String(formData.get('notes') ?? '').trim() || undefined;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Amount must be a positive number.' };
  }
  try {
    const resp = await apiFetch<SettleBalanceResponse>(
      `/admin/earnings/balances/${driverId}/settle`,
      { method: 'POST', body: { amount, notes } },
    );
    revalidatePath('/earnings/balances');
    revalidatePath('/earnings');
    revalidatePath(`/drivers/${driverId}`);
    return { ok: true, amountSettled: resp.amountSettled, newBalance: resp.newBalance };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to settle balance.' };
  }
}
