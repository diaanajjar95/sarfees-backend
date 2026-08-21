'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch, apiUpload } from '@/lib/api';
import type {
  CreateDriverPayload,
  DriverProfile,
  UpdateDriverPayload,
} from '@/lib/types';

export interface DriverFormState {
  ok: boolean;
  error?: string;
}

function readDriverFromForm(formData: FormData): CreateDriverPayload {
  const num = (k: string) => {
    const v = formData.get(k);
    if (v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (k: string) => {
    const v = formData.get(k);
    if (v === null) return undefined;
    const s = String(v).trim();
    return s.length === 0 ? undefined : s;
  };

  return {
    name: str('name') ?? '',
    phoneNumber: str('phoneNumber') ?? '',
    countryCode: str('countryCode') ?? '+962',
    gender: (str('gender') as 'male' | 'female') ?? 'male',
    homeCity: str('homeCity') ?? '',
    vehicleMake: str('vehicleMake'),
    vehicleModel: str('vehicleModel'),
    vehicleColor: str('vehicleColor'),
    vehicleYear: num('vehicleYear'),
    plateNumber: str('plateNumber'),
    passengerCapacity: num('passengerCapacity'),
    language: (str('language') as 'ar' | 'en' | undefined) ?? 'en',
  };
}

export async function createDriverAction(
  _prev: DriverFormState | null,
  formData: FormData,
): Promise<DriverFormState> {
  const payload = readDriverFromForm(formData);
  let created: DriverProfile;
  try {
    created = await apiFetch<DriverProfile>('/admin/drivers', {
      method: 'POST',
      body: payload,
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to create driver.' };
  }
  revalidatePath('/drivers');
  redirect(`/drivers/${created.id}`);
}

export async function updateDriverAction(
  driverId: number,
  _prev: DriverFormState | null,
  formData: FormData,
): Promise<DriverFormState> {
  const payload = readDriverFromForm(formData);
  // Phone + country code are immutable post-creation.
  const { phoneNumber: _p, countryCode: _c, ...editable } = payload;
  void _p;
  void _c;
  const update = editable as UpdateDriverPayload;
  try {
    await apiFetch<DriverProfile>(`/admin/drivers/${driverId}`, {
      method: 'PATCH',
      body: update,
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to update driver.' };
  }
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath('/drivers');
  redirect(`/drivers/${driverId}`);
}

const SUSPENSION_CATEGORIES = new Set([
  'documents',
  'rating',
  'payment',
  'violation',
]);

export async function suspendDriverAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const driverId = Number(formData.get('driverId'));
  const category = String(formData.get('category') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (!Number.isFinite(driverId)) return { ok: false, error: 'Bad driver id.' };
  if (!SUSPENSION_CATEGORIES.has(category))
    return { ok: false, error: 'Pick a suspension category.' };
  if (!reason)
    return { ok: false, error: 'A reason is required — the driver sees it.' };

  try {
    await apiFetch<DriverProfile>(`/admin/drivers/${driverId}/suspend`, {
      method: 'POST',
      body: { category, reason },
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Suspension failed.',
    };
  }
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath('/drivers');
  return { ok: true };
}

export async function reinstateDriverAction(driverId: number): Promise<void> {
  await apiFetch<DriverProfile>(`/admin/drivers/${driverId}/reinstate`, {
    method: 'POST',
  });
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath('/drivers');
}

export interface UploadDocumentResult {
  ok: boolean;
  error?: string;
}

export async function uploadDriverDocumentAction(
  _prev: UploadDocumentResult | null,
  formData: FormData,
): Promise<UploadDocumentResult> {
  const driverId = Number(formData.get('driverId'));
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: 'Choose a file first.' };

  const upstream = new FormData();
  upstream.set('file', file);
  upstream.set('type', String(formData.get('type') ?? ''));
  const documentNumber = String(formData.get('documentNumber') ?? '').trim();
  if (documentNumber) upstream.set('documentNumber', documentNumber);
  const issuedAt = String(formData.get('issuedAt') ?? '');
  if (issuedAt) upstream.set('issuedAt', issuedAt);
  const expiresAt = String(formData.get('expiresAt') ?? '');
  if (expiresAt) upstream.set('expiresAt', expiresAt);

  try {
    await apiUpload(`/admin/drivers/${driverId}/documents`, upstream);
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Upload failed.' };
  }
  revalidatePath(`/drivers/${driverId}`);
  return { ok: true };
}
