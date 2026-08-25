'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';

export interface AppConfigResult { ok: boolean; error?: string }

const SEMVER = /^\d+\.\d+\.\d+$/;

export async function updateAppConfigAction(
  _prev: AppConfigResult | null,
  formData: FormData,
): Promise<AppConfigResult> {
  const app = String(formData.get('app') ?? '');
  if (!['passenger', 'driver'].includes(app))
    return { ok: false, error: 'Unknown app.' };

  const versions: Record<string, string> = {};
  for (const key of [
    'androidMinVersion',
    'androidLatestVersion',
    'iosMinVersion',
    'iosLatestVersion',
  ]) {
    const v = String(formData.get(key) ?? '').trim();
    if (!SEMVER.test(v))
      return { ok: false, error: `${key} must look like 1.2.3` };
    versions[key] = v;
  }

  try {
    await apiFetch(`/admin/app-config/${app}`, {
      method: 'PATCH',
      body: {
        maintenanceMode: formData.get('maintenanceMode') === 'on',
        maintenanceMessageEn: String(formData.get('maintenanceMessageEn') ?? '').trim(),
        maintenanceMessageAr: String(formData.get('maintenanceMessageAr') ?? '').trim(),
        ...versions,
        androidStoreUrl: String(formData.get('androidStoreUrl') ?? '').trim(),
        iosStoreUrl: String(formData.get('iosStoreUrl') ?? '').trim(),
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Update failed.' };
  }
  revalidatePath('/app-settings');
  return { ok: true };
}
