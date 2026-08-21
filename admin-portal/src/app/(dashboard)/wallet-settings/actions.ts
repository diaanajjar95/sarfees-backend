'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';

export interface SettingsResult { ok: boolean; error?: string }

export async function updateWalletConfigAction(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const commissionPercent = Number(formData.get('commissionPercent'));
  const lowBalanceThresholdJod = Number(formData.get('lowBalanceThresholdJod'));
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100)
    return { ok: false, error: 'Commission must be 0–100%.' };
  if (!Number.isFinite(lowBalanceThresholdJod) || lowBalanceThresholdJod < 0)
    return { ok: false, error: 'Threshold must be ≥ 0.' };
  try {
    await apiFetch('/admin/wallet-config', {
      method: 'PATCH',
      body: { commissionPercent, lowBalanceThresholdJod },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Update failed.' };
  }
  revalidatePath('/wallet-settings');
  return { ok: true };
}
