import { apiFetch } from '@/lib/api';
import type { DriverListResponse } from '@/lib/types';

interface KpiTile {
  label: string;
  value: string;
  hint?: string;
}

export default async function DashboardHome() {
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
  const suspended = await safe(() =>
    apiFetch<DriverListResponse>('/admin/drivers?status=suspended&limit=1'),
  );

  const tiles: KpiTile[] = [
    { label: 'Total drivers', value: fmt(allDrivers?.totalItems) },
    {
      label: 'Active right now',
      value: fmt(activeDrivers?.totalItems),
      hint: 'Online and matchable',
    },
    {
      label: 'Currently on trip',
      value: fmt(onTripDrivers?.totalItems),
      hint: 'Mid-journey',
    },
    {
      label: 'Suspended',
      value: fmt(suspended?.totalItems),
      hint: 'Blocked from login',
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
          <div key={t.label} className="surface-card p-5">
            <div
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              {t.label}
            </div>
            <div className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--color-sarfees-gold)' }}>
              {t.value}
            </div>
            {t.hint && (
              <div
                className="mt-1 text-xs"
                style={{ color: 'var(--color-sarfees-soft)' }}
              >
                {t.hint}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 surface-card p-5">
        <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: 'var(--color-sarfees-gold)' }}>
          Coming soon
        </h2>
        <ul className="mt-3 space-y-2 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
          <li>· Live trips browser with map and stop-by-stop timeline</li>
          <li>· Earnings dashboard, commission ledger, settlement tooling</li>
          <li>· Manual trip assignment</li>
          <li>· Announcements composer</li>
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
