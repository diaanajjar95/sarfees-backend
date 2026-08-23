import { getCurrencySymbol } from '@/lib/currency';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type {
  AdminEarningsDashboard,
  EarningsPeriod,
} from '@/lib/types';

interface PageProps {
  searchParams: Promise<{ period?: EarningsPeriod }>;
}

const PERIODS: { value: EarningsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

export default async function EarningsDashboardPage({ searchParams }: PageProps) {
  const cur = await getCurrencySymbol();
  const sp = await searchParams;
  const period = sp.period ?? 'week';

  let data: AdminEarningsDashboard | null = null;
  let error: string | null = null;
  try {
    data = await apiFetch<AdminEarningsDashboard>(
      `/admin/earnings/dashboard?period=${period}`,
    );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load earnings dashboard';
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold">Earnings</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
            Platform-wide cash, commission, and outstanding balances.
          </p>
        </div>
        <div className="flex gap-1 surface-card p-1">
          {PERIODS.map((p) => {
            const active = p.value === period;
            return (
              <Link
                key={p.value}
                href={`/earnings?period=${p.value}`}
                className="px-3 py-1.5 text-xs font-semibold rounded-md"
                style={{
                  backgroundColor: active ? 'var(--color-sarfees-gold)' : 'transparent',
                  color: active ? '#1A1A1A' : 'var(--color-sarfees-muted)',
                }}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          className="mt-6 surface-card px-5 py-4 text-sm"
          style={{ color: 'var(--color-sarfees-error)' }}
        >
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile
              label="Cash collected"
              value={`${data.kpi.totalCashCollected.toFixed(2)} ${cur}`}
            />
            <Tile
              label="Commission earned"
              value={`${data.kpi.totalCommission.toFixed(2)} ${cur}`}
            />
            <Tile
              label="Net to drivers"
              value={`${data.kpi.totalNetPaidToDrivers.toFixed(2)} ${cur}`}
            />
            <Tile label="Trips" value={data.kpi.tripCount} />
          </div>

          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Active drivers right now" value={data.kpi.activeDrivers} />
            <Tile
              label="Outstanding (all drivers)"
              value={`${data.kpi.outstandingTotal.toFixed(2)} ${cur}`}
              hint={
                <Link
                  href="/earnings/balances"
                  style={{ color: 'var(--color-sarfees-gold)' }}
                >
                  View balances →
                </Link>
              }
            />
          </div>

          <div className="mt-8 surface-card overflow-hidden">
            <h2
              className="text-[11px] font-semibold uppercase tracking-widest px-5 py-3"
              style={{
                color: 'var(--color-sarfees-gold)',
                borderBottom: '1px solid var(--color-sarfees-border)',
              }}
            >
              By origin city ({period})
            </h2>
            {data.byOriginCity.length === 0 ? (
              <div
                className="px-5 py-8 text-center text-sm"
                style={{ color: 'var(--color-sarfees-muted)' }}
              >
                No completed trips in this period.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-[11px] font-semibold uppercase tracking-widest text-left"
                    style={{ color: 'var(--color-sarfees-soft)' }}
                  >
                    <th className="px-5 py-3">City</th>
                    <th className="px-5 py-3 text-right">Trips</th>
                    <th className="px-5 py-3 text-right">Cash</th>
                    <th className="px-5 py-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byOriginCity.map((r) => (
                    <tr
                      key={r.city}
                      className="border-t"
                      style={{ borderColor: 'var(--color-sarfees-border)' }}
                    >
                      <td className="px-5 py-3 font-semibold">{r.city}</td>
                      <td className="px-5 py-3 text-right">{r.tripCount}</td>
                      <td className="px-5 py-3 text-right">
                        {r.cashCollected.toFixed(2)} {cur}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.commission.toFixed(2)} {cur}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="surface-card p-5">
      <div
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold" style={{ color: 'var(--color-sarfees-gold)' }}>
        {value}
      </div>
      {hint && (
        <div className="mt-2 text-xs">{hint}</div>
      )}
    </div>
  );
}
