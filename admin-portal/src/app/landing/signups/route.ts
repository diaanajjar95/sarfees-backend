import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api';

/**
 * Public proxy for the landing page's "Join Early" form. The page is
 * served from this same origin (both :80/landing via Caddy and :8080
 * directly), so posting here avoids CORS entirely; we forward to the
 * backend over the internal docker network. No admin session involved.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  try {
    const data = await apiFetch<{ id: number }>('/early-access', {
      method: 'POST',
      body,
      anonymous: true,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
