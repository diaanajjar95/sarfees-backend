'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';

export interface BatchResult {
  ok: boolean;
  error?: string;
  batchId?: string;
  amount?: number;
  codes?: string[];
}

export async function generateBatchAction(
  _prev: BatchResult | null,
  formData: FormData,
): Promise<BatchResult> {
  const amount = Number(formData.get('amount'));
  const count = Number(formData.get('count'));
  if (!Number.isFinite(amount) || amount < 1)
    return { ok: false, error: 'Enter a card value (JD).' };
  if (!Number.isInteger(count) || count < 1 || count > 1000)
    return { ok: false, error: 'Count must be 1–1000.' };
  try {
    const res = await apiFetch<{ batchId: string; amount: number; codes: string[] }>(
      '/admin/cards/batches',
      { method: 'POST', body: { amount, count } },
    );
    revalidatePath('/cards');
    return { ok: true, ...res };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Batch generation failed.' };
  }
}

export interface RedeemResult {
  ok: boolean;
  error?: string;
  step?: 'confirmed' | 'done';
  driverName?: string;
  amount?: number;
}

export async function lookupDriverAction(
  _prev: RedeemResult | null,
  formData: FormData,
): Promise<RedeemResult> {
  const driverPhone = String(formData.get('driverPhone') ?? '').trim();
  if (!/^[0-9]{7,15}$/.test(driverPhone))
    return { ok: false, error: 'Enter the driver mobile number (digits only).' };
  try {
    const res = await apiFetch<{ found: boolean; driverName: string | null }>(
      '/admin/cards/lookup-driver',
      { method: 'POST', body: { driverPhone } },
    );
    if (!res.found)
      return { ok: false, error: 'No driver is registered with that number.' };
    return { ok: true, step: 'confirmed', driverName: res.driverName ?? '' };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Lookup failed.' };
  }
}

export async function redeemCardAction(
  _prev: RedeemResult | null,
  formData: FormData,
): Promise<RedeemResult> {
  const driverPhone = String(formData.get('driverPhone') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  if (!code) return { ok: false, error: 'Enter the card code.' };
  try {
    const res = await apiFetch<{ driverName: string; amount: number }>(
      '/admin/cards/redeem',
      { method: 'POST', body: { code, driverPhone } },
    );
    revalidatePath('/cards');
    return { ok: true, step: 'done', ...res };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Redeem failed.' };
  }
}
