import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api';

/** Same-origin proxy — forwards the httpOnly admin JWT to the API. */
export async function GET() {
  try {
    const data = await apiFetch<unknown>('/admin/drivers/live/overview');
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'overview failed' }, { status: 502 });
  }
}
