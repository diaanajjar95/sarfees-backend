'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, apiFetch } from '@/lib/api';

export interface CreateAdminResult {
  ok: boolean;
  error?: string;
  email?: string;
  tempPassword?: string;
}

export async function createAdminAction(
  _prev: CreateAdminResult | null,
  formData: FormData,
): Promise<CreateAdminResult> {
  const email = String(formData.get('email') ?? '').trim();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const role = String(formData.get('role') ?? '');
  const tempPassword = String(formData.get('tempPassword') ?? '');
  if (tempPassword.length < 8)
    return { ok: false, error: 'Temp password must be at least 8 characters.' };
  try {
    await apiFetch('/admin/admins', {
      method: 'POST',
      body: { email, fullName, role, tempPassword },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Create failed.' };
  }
  revalidatePath('/admins');
  // Echo back so the creator can hand the credentials over — shown once.
  return { ok: true, email, tempPassword };
}

export async function toggleAdminActiveAction(id: number, isActive: boolean) {
  try {
    await apiFetch(`/admin/admins/${id}`, {
      method: 'PATCH',
      body: { isActive },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Update failed.' };
  }
  revalidatePath('/admins');
  return { ok: true };
}
