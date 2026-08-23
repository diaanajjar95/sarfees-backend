import { getCurrencySymbol } from '@/lib/currency';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { DriverBalancesResponse } from '@/lib/types';
import SettleBalanceRow from './_SettleBalanceRow';

interface PageProps {
  searchParams: Promise<{ all?: string; page?: string }>;
}

export default async function BalancesPage({ searchParams }: PageProps) {
  const cur = await getCurrencySymbol();
  const sp = await searchParams;
  const showAll = sp.all === '1';
  const page = Number(sp.page ?? 1);

  const qs = new URLSearchParams();
  qs.set('limit', '20');
  qs.set('page', String(page));
  qs.set('scope', showAll ? 'all' : 'outstanding');

  let resp: DriverBalancesResponse | null = null;
  let error: string | null = null;
  try {
    resp = await apiFetch<DriverBalancesResponse>(
      `/admin/earnings/balances?${qs.toString()}`,
    );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load balances';
  }

  return (
    <div>
      <Link
        href="/earnings"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to earnings
      </Link>

      <div className="mt-2 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Outstanding balances</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
            Commission owed by drivers from completed trips. Settle once paid externally.
          </p>
        </div>
        <div className="flex gap-1 surface-card p-1">
          <Link
            href="/earnings/balances"
            className="px-3 py-1.5 text-xs font-semibold rounded-md"
            style={{
              backgroundColor: !showAll ? 'var(--color-sarfees-gold)' : 'transparent',
              color: !showAll ? '#1A1A1A' : 'var(--color-sarfees-muted)',
            }}
          >
            Outstanding only
          </Link>
          <Link
            href="/earnings/balances?all=1"
            className="px-3 py-1.5 text-xs font-semibold rounded-md"
            style={{
              backgroundColor: showAll ? 'var(--color-sarfees-gold)' : 'transparent',
              color: showAll ? '#1A1A1A' : 'var(--color-sarfees-muted)',
            }}
          >
            All drivers
          </Link>
        </div>
      </div>

      {resp && (
        <div className="mt-4 surface-card p-4">
          <div
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            Total outstanding (platform-wide)
          </div>
          <div
            className="mt-1 text-2xl font-extrabold"
            style={{ color: 'var(--color-sarfees-gold)' }}
          >
            {resp.outstandingTotal.toFixed(2)} {cur}
          </div>
        </div>
      )}

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
                <th className="px-5 py-3">Driver</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3 text-right">Trips</th>
                <th className="px-5 py-3 text-right">Outstanding</th>
                <th className="px-5 py-3 w-[280px]">Settle</th>
              </tr>
            </thead>
            <tbody>
              {resp.data.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-sm"
                    style={{ color: 'var(--color-sarfees-muted)' }}
                  >
                    No drivers in this view.
                  </td>
                </tr>
              )}
              {resp.data.map((row) => (
                <tr
                  key={row.driverId}
                  className="border-t"
                  style={{ borderColor: 'var(--color-sarfees-border)' }}
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/drivers/${row.driverId}`}
                      className="font-semibold"
                    >
                      {row.driverName ?? `#${row.driverId}`}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{row.phoneNumber}</td>
                  <td className="px-5 py-3 text-right">{row.totalTrips}</td>
                  <td className="px-5 py-3 text-right font-semibold" style={{ color: 'var(--color-sarfees-gold)' }}>
                    {row.outstandingBalance.toFixed(2)} {cur}
                  </td>
                  <td className="px-5 py-3">
                    <SettleBalanceRow
                      driverId={row.driverId}
                      maxAmount={row.outstandingBalance}
                    />
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
          </div>
        )}
      </div>
    </div>
  );
}
