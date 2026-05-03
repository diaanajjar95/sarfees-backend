import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { DriverListResponse, DriverStatus } from '@/lib/types';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: DriverStatus;
    page?: string;
  }>;
}

const STATUS_TABS: { value: ''; label: string }[] | { value: '' | DriverStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on_trip', label: 'On trip' },
  { value: 'suspended', label: 'Suspended' },
];

export default async function DriversListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.q ?? '';
  const status = sp.status ?? '';
  const page = Number(sp.page ?? 1);

  const qs = new URLSearchParams();
  qs.set('limit', '20');
  qs.set('page', String(page));
  if (q) qs.set('q', q);
  if (status) qs.set('status', status);

  let resp: DriverListResponse | null = null;
  let error: string | null = null;
  try {
    resp = await apiFetch<DriverListResponse>(`/admin/drivers?${qs.toString()}`);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load drivers';
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Drivers</h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            Pre-approved drivers on the Sarfees platform.
          </p>
        </div>
        <Link href="/drivers/new" className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> New driver
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-sarfees-soft)' }}
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, phone, plate"
            className="input-field pl-9"
          />
        </div>
        <select name="status" defaultValue={status} className="input-field max-w-[180px]">
          {STATUS_TABS.map((t) => (
            <option key={t.value || 'all'} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Apply
        </button>
        {(q || status) && (
          <Link href="/drivers" className="text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
            Clear
          </Link>
        )}
      </form>

      <div className="mt-4 surface-card overflow-hidden">
        {error && (
          <div
            className="px-5 py-4 text-sm"
            style={{ color: 'var(--color-sarfees-error)' }}
          >
            {error}
          </div>
        )}

        {!error && resp && (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-[11px] font-semibold uppercase tracking-widest text-left"
                style={{
                  backgroundColor: 'var(--color-sarfees-dark-3)',
                  color: 'var(--color-sarfees-gold)',
                }}
              >
                <th className="px-5 py-3">Driver</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Vehicle</th>
                <th className="px-5 py-3">City</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Rating</th>
                <th className="px-5 py-3">Trips</th>
                <th className="px-5 py-3">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {resp.data.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-8 text-center text-sm"
                    style={{ color: 'var(--color-sarfees-muted)' }}
                  >
                    No drivers match these filters.
                  </td>
                </tr>
              )}
              {resp.data.map((d) => (
                <tr
                  key={d.id}
                  className="border-t cursor-pointer hover:bg-[rgba(255,255,255,0.02)]"
                  style={{ borderColor: 'var(--color-sarfees-border)' }}
                >
                  <td className="px-5 py-3">
                    <Link href={`/drivers/${d.id}`} className="font-semibold">
                      {d.name ?? '—'}
                    </Link>
                    <div
                      className="text-[11px] font-mono"
                      style={{ color: 'var(--color-sarfees-soft)' }}
                    >
                      #{d.id} · {d.gender ?? '—'}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {d.countryCode} {d.phoneNumber}
                  </td>
                  <td className="px-5 py-3">
                    {d.vehicle.make
                      ? `${d.vehicle.make} ${d.vehicle.model ?? ''}`
                      : '—'}
                    {d.vehicle.plateNumber && (
                      <div
                        className="text-[11px] font-mono"
                        style={{ color: 'var(--color-sarfees-soft)' }}
                      >
                        {d.vehicle.plateNumber}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">{d.homeCity ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`status-pill ${d.status}`}>{d.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-5 py-3">
                    ★ {Number(d.rating).toFixed(1)}
                    <span
                      className="ml-1 text-[11px]"
                      style={{ color: 'var(--color-sarfees-soft)' }}
                    >
                      ({d.ratingCount})
                    </span>
                  </td>
                  <td className="px-5 py-3">{d.totalTrips}</td>
                  <td className="px-5 py-3">
                    {Number(d.outstandingBalance).toFixed(2)} JD
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {resp && (
          <div
            className="flex items-center justify-between px-5 py-3 text-xs"
            style={{
              borderTop: '1px solid var(--color-sarfees-border)',
              color: 'var(--color-sarfees-muted)',
            }}
          >
            <div>
              {resp.totalItems} driver{resp.totalItems === 1 ? '' : 's'} · page {resp.page} of {resp.totalPages}
            </div>
            <div className="flex gap-2">
              <PagerLink
                disabled={!resp.hasPreviousPage}
                href={`/drivers?${withPage(qs, page - 1)}`}
                label="Previous"
              />
              <PagerLink
                disabled={!resp.hasNextPage}
                href={`/drivers?${withPage(qs, page + 1)}`}
                label="Next"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function withPage(qs: URLSearchParams, page: number): string {
  const next = new URLSearchParams(qs);
  next.set('page', String(page));
  return next.toString();
}

function PagerLink({
  href,
  label,
  disabled,
}: {
  href: string;
  label: string;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <span
        className="px-3 py-1.5 rounded-md text-xs"
        style={{
          color: 'var(--color-sarfees-soft)',
          border: '1px solid var(--color-sarfees-border)',
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-xs font-semibold"
      style={{
        color: 'var(--color-sarfees-gold)',
        border: '1px solid rgba(250,190,44,0.4)',
      }}
    >
      {label}
    </Link>
  );
}
