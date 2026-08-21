import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface CustomerRow {
  id: number;
  name: string | null;
  countryCode: string | null;
  phoneNumber: string;
  gender: string | null;
  rating: number;
  ratingCount: number;
  totalTrips: number;
  completedTrips: number;
  isProfileCompleted: boolean;
  createdAt: string;
}

interface ListResponse {
  data: CustomerRow[];
  page: number;
  totalItems: number;
  totalPages: number;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const params = new URLSearchParams({ limit: '20' });
  if (q) params.set('search', q);
  if (page) params.set('page', page);

  const res = await apiFetch<ListResponse>(`/admin/customers?${params}`);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Customers</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
            {res.totalItems} registered passenger{res.totalItems === 1 ? '' : 's'}.
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search name or phone…"
            className="input-field w-64"
          />
          <button type="submit" className="btn-secondary">Search</button>
        </form>
      </div>

      <div className="mt-4 surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--color-sarfees-soft)' }}>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Gender</th>
              <th className="px-5 py-3">Rating</th>
              <th className="px-5 py-3">Trips</th>
              <th className="px-5 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {res.data.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-center" style={{ color: 'var(--color-sarfees-muted)' }}>No customers match.</td></tr>
            )}
            {res.data.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-sarfees-border)' }}>
                <td className="px-5 py-3">
                  <Link href={`/customers/${c.id}`} className="font-semibold hover:underline" style={{ color: 'var(--color-sarfees-gold)' }}>
                    {c.name ?? `Customer #${c.id}`}
                  </Link>
                  {!c.isProfileCompleted && (
                    <span className="ml-2 text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-sarfees-soft)' }}>
                      incomplete
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">{c.countryCode} {c.phoneNumber}</td>
                <td className="px-5 py-3">{c.gender ?? '—'}</td>
                <td className="px-5 py-3">
                  ★ {Number(c.rating).toFixed(2)}
                  <span style={{ color: 'var(--color-sarfees-soft)' }}> ({c.ratingCount})</span>
                </td>
                <td className="px-5 py-3">
                  {c.completedTrips}
                  <span style={{ color: 'var(--color-sarfees-soft)' }}> / {c.totalTrips}</span>
                </td>
                <td className="px-5 py-3" style={{ color: 'var(--color-sarfees-muted)' }}>
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {res.totalPages > 1 && (
        <div className="mt-3 flex gap-2 text-sm">
          {Array.from({ length: res.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
              className="rounded px-3 py-1"
              style={p === res.page
                ? { background: 'var(--color-sarfees-gold-surface)', color: 'var(--color-sarfees-gold)', fontWeight: 700 }
                : { color: 'var(--color-sarfees-muted)' }}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
