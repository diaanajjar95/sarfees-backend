import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api';

/**
 * Client-side polling proxy. The live driver map polls this every
 * 30 s from the browser; this route forwards to the Sarfees API
 * using the httpOnly admin JWT cookie so we never expose the token
 * to client JS.
 */
export async function GET() {
  try {
    const data = await apiFetch<unknown>('/admin/drivers/live/map');
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
