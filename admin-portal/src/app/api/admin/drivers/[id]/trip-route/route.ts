import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api';

/**
 * Client-side proxy for the admin map's "show route" click.
 * Forwards to /admin/drivers/:id/trip/route using the httpOnly
 * admin JWT cookie so the token never touches client JS.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const data = await apiFetch<unknown>(`/admin/drivers/${id}/route`);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
