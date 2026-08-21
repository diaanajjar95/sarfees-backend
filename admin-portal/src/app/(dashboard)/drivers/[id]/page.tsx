import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Pencil } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/auth';
import type { AdminDriverDetail } from '@/lib/types';
import { reinstateDriverAction } from '../actions';
import SuspendWithReason from '../../_components/SuspendWithReason';
import WalletCreditForm from './_WalletCreditForm';
import DocumentsSection, { type DocumentRow } from './_DocumentsSection';

interface WalletSummary {
  balance: number;
  lowBalanceThreshold: number;
  isLow: boolean;
  commissionPercent: number;
}

interface WalletTx {
  id: number;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  tripId: number | null;
  cardCodeMasked: string | null;
  createdAt: string;
}

const TX_LABEL: Record<string, string> = {
  card_topup: 'Card top-up',
  admin_credit: 'Manual credit',
  refund: 'Refund',
  commission: 'Trip commission',
  adjustment: 'Adjustment',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DriverDetailPage({ params }: PageProps) {
  const { id } = await params;
  const driverId = Number(id);
  if (!Number.isFinite(driverId)) notFound();

  let driver: AdminDriverDetail;
  try {
    driver = await apiFetch<AdminDriverDetail>(`/admin/drivers/${driverId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const isSuspended = driver.status === 'suspended';
  const onTrip = driver.status === 'on_trip';

  // Wallet block — visible to roles the API allows (super_admin,
  // finance, ops_manager); anyone else just doesn't get the section.
  const me = await getCurrentAdmin();
  const canCredit = !!me && ['super_admin', 'finance'].includes(me.role);
  let documents: DocumentRow[] = [];
  try {
    const docs = await apiFetch<{ data: DocumentRow[] }>(
      `/admin/drivers/${driverId}/documents`,
    );
    documents = docs.data;
  } catch {
    /* section hidden on error */
  }

  let wallet: WalletSummary | null = null;
  let walletTx: WalletTx[] = [];
  try {
    const [summary, txPage] = await Promise.all([
      apiFetch<WalletSummary>(`/admin/wallets/${driverId}`),
      apiFetch<{ data: WalletTx[] }>(
        `/admin/wallets/${driverId}/transactions?limit=10`,
      ),
    ]);
    wallet = summary;
    walletTx = txPage.data;
  } catch {
    /* role not allowed or wallet unavailable — hide the section */
  }

  return (
    <div>
      <Link
        href="/drivers"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to drivers
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{driver.name ?? 'Unnamed'}</h1>
          <div
            className="mt-1 flex items-center gap-3 text-sm"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            <span className={`status-pill ${driver.status}`}>{driver.status.replace('_', ' ')}</span>
            <span>
              ★ {Number(driver.rating).toFixed(1)} · {driver.totalTrips} trips
            </span>
            <span>
              {driver.countryCode} {driver.phoneNumber}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/drivers/${driver.id}/edit`}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Pencil size={14} /> Edit
          </Link>
          {!isSuspended ? (
            <SuspendWithReason driverId={driver.id} disabled={onTrip} />
          ) : (
            <form
              action={async () => {
                'use server';
                await reinstateDriverAction(driver.id);
              }}
            >
              <button type="submit" className="btn-primary">Reinstate</button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DataCard title="Identity">
          <Row label="Gender" value={driver.gender ?? '—'} />
          <Row label="Home city" value={driver.homeCity ?? '—'} />
          <Row label="Language" value={driver.language} />
          <Row label="Member since" value={fmtDate(driver.createdAt)} />
        </DataCard>

        <DataCard title="Vehicle">
          <Row
            label="Make / model"
            value={
              driver.vehicle.make
                ? `${driver.vehicle.make} ${driver.vehicle.model ?? ''}`.trim()
                : '—'
            }
          />
          <Row label="Year" value={driver.vehicle.year ?? '—'} />
          <Row label="Color" value={driver.vehicle.color ?? '—'} />
          <Row label="Plate" value={driver.vehicle.plateNumber ?? '—'} />
          <Row label="Capacity" value={`${driver.vehicle.passengerCapacity} passengers`} />
        </DataCard>

        <DataCard title="Reputation & finance">
          <Row
            label="Rating"
            value={`★ ${Number(driver.rating).toFixed(2)} (${driver.ratingCount})`}
          />
          <Row label="Completed trips" value={driver.completedTripCount} />
          <Row label="Cancelled trips" value={driver.cancelledTripCount} />
          <Row
            label="Outstanding balance"
            value={`${Number(driver.outstandingBalance).toFixed(2)} JD`}
          />
        </DataCard>
      </div>

      <DocumentsSection driverId={driver.id} documents={documents} />

      {wallet && (
        <div className="mt-4 surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              Wallet
            </h2>
            {wallet.isLow && (
              <span
                className="rounded px-2 py-0.5 text-xs font-bold"
                style={{ color: 'var(--color-sarfees-error)', background: 'var(--color-sarfees-error-light)' }}
              >
                low balance
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div>
              <div className="text-2xl font-extrabold">
                {Number(wallet.balance).toFixed(2)} JD
              </div>
              <div className="text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>
                current balance
              </div>
            </div>
            <div className="text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
              Commission {Number(wallet.commissionPercent)}% of trip total ·
              warning below {Number(wallet.lowBalanceThreshold).toFixed(2)} JD
            </div>
          </div>

          {canCredit && <WalletCreditForm driverId={driver.id} />}

          <div className="mt-4">
            {walletTx.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
                No wallet activity yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-[11px] font-semibold uppercase tracking-widest text-left"
                    style={{ color: 'var(--color-sarfees-soft)' }}
                  >
                    <th className="py-2">Type</th>
                    <th className="py-2">Detail</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2 text-right">Balance after</th>
                    <th className="py-2 text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {walletTx.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t"
                      style={{ borderColor: 'var(--color-sarfees-border)' }}
                    >
                      <td className="py-2 font-semibold">{TX_LABEL[t.type] ?? t.type}</td>
                      <td className="py-2" style={{ color: 'var(--color-sarfees-muted)' }}>
                        {t.cardCodeMasked ?? (t.tripId ? `Trip #${t.tripId}` : t.note ?? '—')}
                      </td>
                      <td
                        className="py-2 text-right font-semibold"
                        style={{ color: t.amount >= 0 ? '#2E7D32' : 'var(--color-sarfees-error)' }}
                      >
                        {t.amount >= 0 ? '+' : ''}{Number(t.amount).toFixed(2)} JD
                      </td>
                      <td className="py-2 text-right">{Number(t.balanceAfter).toFixed(2)} JD</td>
                      <td className="py-2 text-right" style={{ color: 'var(--color-sarfees-soft)' }}>
                        {fmtDateTime(t.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {driver.activePreferences && (
        <div className="mt-4 surface-card p-5">
          <h2
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-sarfees-gold)' }}
          >
            Active session preferences
          </h2>
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <Row
              label="Destination"
              value={driver.activePreferences.destinationCity ?? 'Any'}
            />
            <Row
              label="Trip types"
              value={driver.activePreferences.tripTypes.join(', ') || '—'}
            />
            <Row
              label="Going home"
              value={driver.activePreferences.goingHome ? 'Yes' : 'No'}
            />
            <Row
              label="Min passengers"
              value={driver.activePreferences.minPassengers ?? 'Any'}
            />
          </div>
        </div>
      )}

      <div className="mt-4 surface-card p-5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-sarfees-gold)' }}
        >
          Recent trips ({driver.tripHistory.length})
        </h2>
        <div className="mt-3">
          {driver.tripHistory.length === 0 ? (
            <p
              className="text-sm"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              No trips yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-[11px] font-semibold uppercase tracking-widest text-left"
                  style={{ color: 'var(--color-sarfees-soft)' }}
                >
                  <th className="py-2">Route</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Departure</th>
                  <th className="py-2 text-right">Cash</th>
                  <th className="py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {driver.tripHistory.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t"
                    style={{ borderColor: 'var(--color-sarfees-border)' }}
                  >
                    <td className="py-2 font-semibold">{t.route}</td>
                    <td className="py-2">{t.type}</td>
                    <td className="py-2">{t.status.replace('_', ' ')}</td>
                    <td className="py-2">{fmtDateTime(t.departureTime)}</td>
                    <td className="py-2 text-right">{Number(t.totalCashCollected).toFixed(2)} JD</td>
                    <td className="py-2 text-right">
                      {t.netEarnings != null ? `${Number(t.netEarnings).toFixed(2)} JD` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-4 surface-card p-5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-sarfees-gold)' }}
        >
          Decline log ({driver.declineLog.length})
        </h2>
        <div className="mt-3">
          {driver.declineLog.length === 0 ? (
            <p
              className="text-sm"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              No declines on record.
            </p>
          ) : (
            <ul className="text-sm space-y-1">
              {driver.declineLog.map((d) => (
                <li key={d.id} className="flex justify-between">
                  <span>
                    {d.reason} {d.autoDeclined && (
                      <span
                        className="ml-1 text-[10px] uppercase tracking-widest"
                        style={{ color: 'var(--color-sarfees-warning)' }}
                      >
                        auto
                      </span>
                    )}
                  </span>
                  <span style={{ color: 'var(--color-sarfees-soft)' }}>
                    {fmtDateTime(d.declinedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-5">
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-gold)' }}
      >
        {title}
      </h2>
      <dl className="mt-3 space-y-2 text-sm">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: 'var(--color-sarfees-muted)' }}>{label}</dt>
      <dd className="font-semibold text-right">{value}</dd>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}
