import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type {
  PassengerRequestsListResponse,
  PassengerRequestStatus,
} from '@/lib/types';

interface PageProps {
  searchParams: Promise<{
    status?: PassengerRequestStatus | '';
    page?: string;
  }>;
}

const STATUS_TABS: { value: '' | PassengerRequestStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'TRIP_IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, { fg: string; border: string }> = {
  PENDING: { fg: '#F57C00', border: 'rgba(245,124,0,0.35)' },
  MATCHED: { fg: '#B57E0A', border: 'rgba(250,190,44,0.35)' },
  DRIVER_EN_ROUTE: { fg: '#B57E0A', border: 'rgba(250,190,44,0.35)' },
  ARRIVED_AT_PICKUP: { fg: '#B57E0A', border: 'rgba(250,190,44,0.35)' },
  TRIP_IN_PROGRESS: { fg: '#2E7D32', border: 'rgba(46,125,50,0.35)' },
  ARRIVING_AT_DROPOFF: { fg: '#2E7D32', border: 'rgba(46,125,50,0.35)' },
  COMPLETED: { fg: '#4CAF50', border: 'rgba(76,175,80,0.35)' },
  CANCELLED: { fg: '#C62828', border: 'rgba(198,40,40,0.35)' },
};

export default async function PassengerRequestsListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status ?? 'PENDING';
  const page = Number(sp.page ?? 1);

  const qs = new URLSearchParams();
  qs.set('limit', '20');
  qs.set('page', String(page));
  if (status) qs.set('status', status);

  let resp: PassengerRequestsListResponse | null = null;
  let error: string | null = null;
  try {
    resp = await apiFetch<PassengerRequestsListResponse>(
      `/admin/passenger-requests?${qs.toString()}`,
    );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load requests';
  }

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Passenger requests</h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            Trip requests created by passengers. Pending = awaiting driver
            assignment.
          </p>
        </div>
        {resp && (
          <div className="surface-card px-4 py-3">
            <div
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              PENDING
            </div>
            <div
              className="text-2xl font-extrabold"
              style={{ color: 'var(--color-sarfees-warning)' }}
            >
              {resp.pendingCount}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1 surface-card p-1 w-fit">
        {STATUS_TABS.map((t) => {
          const active = (status || '') === t.value;
          const href = t.value
            ? `/passenger-requests?status=${t.value}`
            : '/passenger-requests?status=';
          return (
            <Link
              key={t.value || 'all'}
              href={href}
              className="px-3 py-1.5 text-xs font-semibold rounded-md"
              style={{
                backgroundColor: active ? 'var(--color-sarfees-gold)' : 'transparent',
                color: active ? '#1A1A1A' : 'var(--color-sarfees-muted)',
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

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
                <th className="px-5 py-3">Request</th>
                <th className="px-5 py-3">Passenger</th>
                <th className="px-5 py-3">Route</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Seats</th>
                <th className="px-5 py-3 text-right">Fare</th>
                <th className="px-5 py-3">Driver</th>
              </tr>
            </thead>
            <tbody>
              {resp.data.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-sm"
                    style={{ color: 'var(--color-sarfees-muted)' }}
                  >
                    No requests in this view.
                  </td>
                </tr>
              )}
              {resp.data.map((r) => {
                const c = STATUS_COLOR[r.status] ?? STATUS_COLOR.PENDING;
                return (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-[#FFF8E7]"
                    style={{ borderColor: 'var(--color-sarfees-border)' }}
                  >
                    <td className="px-5 py-3">
                      <Link href={`/passenger-requests/${r.id}`} className="font-semibold">
                        #{r.id}
                      </Link>
                      <div
                        className="text-[11px] font-mono"
                        style={{ color: 'var(--color-sarfees-soft)' }}
                      >
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold">{r.passengerName}</div>
                      <div
                        className="text-[11px]"
                        style={{ color: 'var(--color-sarfees-soft)' }}
                      >
                        {r.passengerPhone}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {r.departureCity ?? '—'} → {r.arrivalCity ?? '—'}
                      {r.isFemaleOnly && (
                        <div
                          className="text-[10px] uppercase tracking-widest mt-0.5"
                          style={{ color: '#FF6B9D' }}
                        >
                          women-only
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="status-pill"
                        style={{ color: c.fg, border: `1px solid ${c.border}` }}
                      >
                        {r.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">{r.seatsCount}</td>
                    <td className="px-5 py-3 text-right">
                      {Number(r.totalFare).toFixed(2)} JD
                    </td>
                    <td className="px-5 py-3">
                      {r.driverName ? (
                        <Link href={`/drivers/${r.driverId}`}>{r.driverName}</Link>
                      ) : r.status === 'PENDING' ? (
                        <Link
                          href={`/passenger-requests/${r.id}`}
                          className="text-xs font-semibold"
                          style={{ color: 'var(--color-sarfees-gold)' }}
                        >
                          Assign…
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--color-sarfees-soft)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
              {resp.totalItems} request{resp.totalItems === 1 ? '' : 's'} · page {resp.page} of {resp.totalPages}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
