import { cookies } from 'next/headers';
import type { ApiEnvelope } from './types';

const API_URL = process.env.SARFEES_API_URL ?? 'http://localhost:3000';
export const ACCESS_COOKIE = 'sarfees_admin_at';
export const REFRESH_COOKIE = 'sarfees_admin_rt';
export const ADMIN_COOKIE = 'sarfees_admin_user';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip Authorization header (used by /admin/auth/login) */
  anonymous?: boolean;
  /** Override the bearer token instead of reading from cookies (used by login flow) */
  token?: string;
  /** Forward Accept-Language for i18n responses */
  language?: string;
}

/**
 * Server-side typed fetch against the Sarfees backend.
 * Reads the admin access token from httpOnly cookies. Throws `ApiError`
 * with the backend's localized message on non-2xx.
 */
export async function apiFetch<T>(
  path: string,
  opts: FetchOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.language) headers['Accept-Language'] = opts.language;

  if (!opts.anonymous) {
    const token =
      opts.token ?? (await cookies()).get(ACCESS_COOKIE)?.value ?? '';
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.status, `Backend returned non-JSON (HTTP ${res.status})`);
  }

  if (!res.ok || envelope == null) {
    throw new ApiError(
      res.status,
      envelope?.message ?? `HTTP ${res.status}`,
    );
  }

  // Endpoints with no payload return data:null; cast to T which the caller types as void.
  return (envelope.data ?? (undefined as unknown)) as T;
}

/**
 * Multipart POST (file uploads). Same auth/envelope handling as
 * apiFetch, but passes FormData through untouched so fetch sets the
 * multipart boundary itself.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = (await cookies()).get(ACCESS_COOKIE)?.value ?? '';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.status, `Backend returned non-JSON (HTTP ${res.status})`);
  }
  if (!res.ok || envelope == null) {
    throw new ApiError(res.status, envelope?.message ?? `HTTP ${res.status}`);
  }
  return (envelope.data ?? (undefined as unknown)) as T;
}
