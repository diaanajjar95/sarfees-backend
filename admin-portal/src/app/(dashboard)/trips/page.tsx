import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type {
  AdminTripsListResponse,
  DriverTripStatus,
  DriverTripType,
} from '@/lib/types';
import TripRow from './_TripRow';

interface PageProps {
  searchParams: Promise<{
    status?: DriverTripStatus | '';
    type?: DriverTripType | '';
    fromDate?: string;
    toDate?: string;
    page?: string;
  }>;
}

const STATUS_OPTIONS: { value: '' | DriverTripStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'offered', label: 'Offered' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

const TYPE_OPTIONS: { value: '' | DriverTripType; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'shared', label: 'Shared' },
  { value: 'women_only', label: 'Women-only' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'packages_only', label: 'Packages only' },
];

const STATUS_COLOR: Record<string, { fg: string; border: string }> = {
  offered: { fg: '#B57E0A', border: 'rgba(250,190,44,0.35)' },
  accepted: { fg: '#B57E0A', border: 'rgba(250,190,44,0.35)' },
  in_progress: { fg: '#2E7D32', border: 'rgba(46,125,50,0.35)' },
  completed: { fg: '#4CAF50', border: 'rgba(76,175,80,0.35)' },
  cancelled: { fg: '#C62828', border: 'rgba(198,40,40,0.35)' },
  expired: { fg: '#9E9E9E', border: 'rgba(255,255,255,0.10)' },
  declined: { fg: '#9E9E9E', border: 'rgba(255,255,255,0.10)' },
};

export default async function TripsListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status ?? '';
  const type = sp.type ?? '';
  const fromDate = sp.fromDate ?? '';
  const toDate = sp.toDate ?? '';
  const page = Number(sp.page ?? 1);

  const qs = new URLSearchParams();
  qs.set('limit', '20');
  qs.set('page', String(page));
  if (status) qs.set('status', status);
  if (type) qs.set('type', type);
  if (fromDate) qs.set('fromDate', fromDate);
  if (toDate) qs.set('toDate', toDate);

  let resp: AdminTripsListResponse | null = null;
  let error: string | null = null;
  try {
    resp = await apiFetch<AdminTripsListResponse>(`/admin/trips?${qs.toString()}`);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load trips';
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Trips</h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            All multi-stop driver assignments across the platform.
          </p>
        </div>
        <Link href="/trips/new" className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> Manual assign
        </Link>
      </div>

      <form className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-2">
        <select name="status" defaultValue={status} className="input-field">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all-status'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type} className="input-field">
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value || 'all-type'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="fromDate"
          defaultValue={fromDate}
          className="input-field"
          placeholder="From"
        />
        <input
          type="date"
          name="toDate"
          defaultValue={toDate}
          className="input-field"
          placeholder="To"
        />
        <button type="submit" className="btn-secondary inline-flex items-center justify-center gap-2">
          <Search size={14} /> Apply
        </button>
      </form>

      <div className="mt-4 surface-card overflow-hidden">
        {error && (
          <div className="px-5 py-4 text-sm" style={{ color: 'var(--color-sarfees-error)' }}>
            {error}
          </div>
        )}

        {resp && (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-[11px] font-semibold uppercase tracking-widest text-left"
                style={{
                  backgroundColor: 'var(--color-sarfees-dark-3)',
                  color: 'var(--color-sarfees-gold)',
                }}
              >
                <th className="px-5 py-3 w-[80px]">ID</th>
                <th className="px-5 py-3">Route</th>
                <th className="px-5 py-3">Driver</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Departure</th>
                <th className="px-5 py-3 text-right">Cash</th>
                <th className="px-5 py-3 text-right">Net</th>
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
                    No trips match these filters.
                  </td>
                </tr>
              )}
              {resp.data.map((t) => (
                <TripRow
                  key={t.id}
                  trip={t}
                  statusColor={STATUS_COLOR[t.status] ?? STATUS_COLOR.expired}
                />
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
              {resp.totalItems} trip{resp.totalItems === 1 ? '' : 's'} · page {resp.page} of {resp.totalPages}
            </div>
            <div className="flex gap-2">
              <PagerLink
                disabled={!resp.hasPreviousPage}
                href={`/trips?${withPage(qs, page - 1)}`}
                label="Previous"
              />
              <PagerLink
                disabled={!resp.hasNextPage}
                href={`/trips?${withPage(qs, page + 1)}`}
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
        style={{ color: 'var(--color-sarfees-soft)', border: '1px solid var(--color-sarfees-border)' }}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-xs font-semibold"
      style={{ color: 'var(--color-sarfees-gold)', border: '1px solid rgba(250,190,44,0.4)' }}
    >
      {label}
    </Link>
  );
}
