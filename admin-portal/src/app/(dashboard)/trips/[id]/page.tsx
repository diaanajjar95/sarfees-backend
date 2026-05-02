import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import type { ManifestResponse } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) notFound();

  let manifest: ManifestResponse;
  try {
    manifest = await apiFetch<ManifestResponse>(`/admin/trips/${tripId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const commissionPct = (Number(manifest.commissionRate) * 100).toFixed(1);

  return (
    <div>
      <Link
        href="/trips"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to trips
      </Link>

      <div className="mt-2">
        <h1 className="text-2xl font-extrabold">
          {manifest.originCity} → {manifest.destinationCity}
        </h1>
        <div
          className="mt-1 flex items-center gap-3 text-sm"
          style={{ color: 'var(--color-sarfees-muted)' }}
        >
          <span>#{manifest.id}</span>
          <span>· {manifest.type.replace('_', ' ')}</span>
          <span>· {manifest.status.replace('_', ' ')}</span>
          <span>· departs {new Date(manifest.departureTime).toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Stops" value={manifest.summary.stopCount} />
        <Tile label="Passengers" value={manifest.summary.passengerCount} />
        <Tile label="Packages" value={manifest.summary.packageCount} />
        <Tile
          label="Cash collected / expected"
          value={`${Number(manifest.totalCashCollected).toFixed(2)} / ${Number(
            manifest.totalCashExpected,
          ).toFixed(2)} JD`}
        />
      </div>

      <div className="mt-6 surface-card p-5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-sarfees-gold)' }}
        >
          Stop-by-stop ({manifest.stops.length} stops · est{' '}
          {manifest.summary.estimatedDurationMinutes}m · commission {commissionPct}%)
        </h2>

        <ol className="mt-4 space-y-3">
          {manifest.stops.map((s) => (
            <li
              key={s.id}
              className="surface-elevated p-4"
              style={{
                borderLeft: `4px solid ${
                  s.status === 'confirmed'
                    ? '#4CAF50'
                    : s.status === 'arrived'
                      ? '#FABE2C'
                      : 'var(--color-sarfees-border)'
                }`,
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-sarfees-soft)' }}>
                    Stop {s.order + 1} · {s.type.replace('_', ' ')}
                  </div>
                  <div className="text-sm font-extrabold mt-1">
                    {s.city}
                    {s.address && (
                      <span
                        className="ml-2 font-normal text-xs"
                        style={{ color: 'var(--color-sarfees-muted)' }}
                      >
                        — {s.address}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`status-pill`} style={{ color: 'var(--color-sarfees-text)' }}>
                    {s.status}
                  </span>
                  <div
                    className="text-xs mt-1"
                    style={{ color: 'var(--color-sarfees-muted)' }}
                  >
                    cash: {Number(s.cashExpected).toFixed(2)} JD
                  </div>
                </div>
              </div>

              {s.passengers.length > 0 && (
                <div className="mt-3">
                  <div
                    className="text-[10px] uppercase tracking-widest mb-1"
                    style={{ color: 'var(--color-sarfees-soft)' }}
                  >
                    Passengers
                  </div>
                  <ul className="text-xs space-y-1">
                    {s.passengers.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>
                          {p.name || '—'}{' '}
                          <span style={{ color: 'var(--color-sarfees-soft)' }}>
                            {p.phoneMasked}
                          </span>
                        </span>
                        <span style={{ color: 'var(--color-sarfees-muted)' }}>
                          {p.role} · {p.status} ·{' '}
                          {Number(p.fare).toFixed(2)} JD
                          {p.cashCollected === false && ' · cash unpaid'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.packages.length > 0 && (
                <div className="mt-3">
                  <div
                    className="text-[10px] uppercase tracking-widest mb-1"
                    style={{ color: 'var(--color-sarfees-soft)' }}
                  >
                    Packages
                  </div>
                  <ul className="text-xs space-y-1">
                    {s.packages.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>
                          {p.reference}
                          <span
                            className="ml-2"
                            style={{ color: 'var(--color-sarfees-soft)' }}
                          >
                            {p.senderName} → {p.receiverName}
                          </span>
                        </span>
                        <span style={{ color: 'var(--color-sarfees-muted)' }}>
                          {p.role} · {p.status} ·{' '}
                          {Number(p.fee).toFixed(2)} JD
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="surface-card p-4">
      <div
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        {label}
      </div>
      <div className="mt-1 text-xl font-extrabold" style={{ color: 'var(--color-sarfees-gold)' }}>
        {value}
      </div>
    </div>
  );
}
