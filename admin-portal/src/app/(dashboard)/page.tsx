import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type {
  DriverListResponse,
  PassengerRequestsListResponse,
} from '@/lib/types';

interface KpiTile {
  label: string;
  value: string;
  hint?: React.ReactNode;
  alert?: boolean;
}

export default async function DashboardHome() {
  const me = await getCurrentAdmin();
  if (me?.role === 'seller') redirect('/cards');

  // Pull a single page just for counts; future iterations will hit a /admin/stats endpoint.
  const allDrivers = await safe(() =>
    apiFetch<DriverListResponse>('/admin/drivers?limit=1'),
  );
  const activeDrivers = await safe(() =>
    apiFetch<DriverListResponse>('/admin/drivers?status=active&limit=1'),
  );
  const onTripDrivers = await safe(() =>
    apiFetch<DriverListResponse>('/admin/drivers?status=on_trip&limit=1'),
  );
  const pendingRequests = await safe(() =>
    apiFetch<PassengerRequestsListResponse>(
      '/admin/passenger-requests?status=PENDING&limit=1',
    ),
  );

  const tiles: KpiTile[] = [
    {
      label: 'Pending requests',
      value: fmt(pendingRequests?.pendingCount),
      alert: (pendingRequests?.pendingCount ?? 0) > 0,
      hint: (pendingRequests?.pendingCount ?? 0) > 0 && (
        <Link
          href="/passenger-requests"
          style={{ color: 'var(--color-sarfees-warning)' }}
        >
          Awaiting driver assignment →
        </Link>
      ),
    },
    {
      label: 'Active drivers',
      value: fmt(activeDrivers?.totalItems),
      hint: 'Online and matchable',
    },
    {
      label: 'Currently on trip',
      value: fmt(onTripDrivers?.totalItems),
      hint: 'Mid-journey',
    },
    {
      label: 'Total drivers',
      value: fmt(allDrivers?.totalItems),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Operations dashboard</h1>
      <p
        className="mt-1 text-sm"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        High-level snapshot of the Sarfees platform.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="surface-card p-5"
            style={
              t.alert
                ? { borderColor: 'rgba(245,124,0,0.45)' }
                : undefined
            }
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              {t.label}
            </div>
            <div
              className="mt-2 text-3xl font-extrabold"
              style={{
                color: t.alert
                  ? 'var(--color-sarfees-warning)'
                  : 'var(--color-sarfees-gold)',
              }}
            >
              {t.value}
            </div>
            {t.hint && <div className="mt-1 text-xs">{t.hint}</div>}
          </div>
        ))}
      </div>

      <div className="mt-10 surface-card p-5">
        <h2
          className="text-sm font-semibold tracking-wider uppercase"
          style={{ color: 'var(--color-sarfees-gold)' }}
        >
          How matching works today
        </h2>
        <ul
          className="mt-3 space-y-2 text-sm"
          style={{ color: 'var(--color-sarfees-muted)' }}
        >
          <li>
            ·{' '}
            <strong style={{ color: 'var(--color-sarfees-text)' }}>
              Auto-matcher
            </strong>{' '}
            — runs immediately when a passenger creates a trip request. Picks
            the highest-rated active driver whose preferences accept the trip
            and creates an OFFERED <code>DriverTrip</code>.
          </li>
          <li>
            ·{' '}
            <strong style={{ color: 'var(--color-sarfees-text)' }}>
              Manual fallback
            </strong>{' '}
            — if no driver is eligible, the request stays as <code>PENDING</code>{' '}
            and shows up under{' '}
            <Link
              href="/passenger-requests"
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              Passenger requests
            </Link>
            . Click any pending request → <strong>Assign to driver</strong> to
            push it through manually.
          </li>
        </ul>
      </div>
    </div>
  );
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function fmt(n: number | undefined | null) {
  if (n == null) return '–';
  return n.toLocaleString();
}
