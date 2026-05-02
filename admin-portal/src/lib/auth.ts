'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ACCESS_COOKIE,
  ADMIN_COOKIE,
  ApiError,
  REFRESH_COOKIE,
  apiFetch,
} from './api';
import type { AdminUser, LoginResponse } from './types';

const ACCESS_TTL_SECONDS = 30 * 60;        // mirror JWT_ADMIN access (30m)
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // mirror JWT_ADMIN refresh (7d)

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

export interface LoginResult {
  ok: boolean;
  error?: string;
  mustChangePassword?: boolean;
}

export async function loginAction(
  _prev: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }

  let resp: LoginResponse;
  try {
    resp = await apiFetch<LoginResponse>('/admin/auth/login', {
      method: 'POST',
      anonymous: true,
      body: { email, password },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to reach the backend.' };
  }

  await persistSession(resp);
  return { ok: true, mustChangePassword: resp.admin.mustChangePassword };
}

export async function persistSession(resp: LoginResponse): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, resp.accessToken, cookieOpts(ACCESS_TTL_SECONDS));
  jar.set(REFRESH_COOKIE, resp.refreshToken, cookieOpts(REFRESH_TTL_SECONDS));
  jar.set(
    ADMIN_COOKIE,
    JSON.stringify(resp.admin),
    cookieOpts(REFRESH_TTL_SECONDS),
  );
}

export async function logoutAction(): Promise<void> {
  try {
    await apiFetch<void>('/admin/auth/logout', { method: 'POST' });
  } catch {
    // best-effort — clear cookies regardless
  }
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(ADMIN_COOKIE);
  redirect('/login');
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
}

export async function changePasswordAction(
  _prev: ChangePasswordResult | null,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'New password and confirmation do not match.' };
  }

  try {
    const updated = await apiFetch<AdminUser>('/admin/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    // Refresh tokens are now invalidated server-side; force a re-login.
    const jar = await cookies();
    jar.delete(ACCESS_COOKIE);
    jar.delete(REFRESH_COOKIE);
    jar.set(
      ADMIN_COOKIE,
      JSON.stringify(updated),
      cookieOpts(REFRESH_TTL_SECONDS),
    );
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to reach the backend.' };
  }

  return { ok: true };
}
