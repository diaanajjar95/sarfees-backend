import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  Clock,
  Flag,
  HandCoins,
  MapPin,
  PackageCheck,
  PackageX,
  PlayCircle,
  Send,
  TimerOff,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import type { AdminTripDetail, LifecycleEventKind } from '@/lib/types';
import CancelWithReason from '../../_components/CancelWithReason';
import { cancelTripAction } from '../actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_COLOR: Record<string, string> = {
  offered: '#B57E0A',
  accepted: '#B57E0A',
  in_progress: '#2E7D32',
  completed: '#4CAF50',
  cancelled: '#C62828',
  expired: '#9E9E9E',
  declined: '#9E9E9E',
};

const EVENT_META: Record<
  LifecycleEventKind,
  { Icon: typeof Send; color: string }
> = {
  offered: { Icon: Send, color: '#B57E0A' },
  offer_expired: { Icon: TimerOff, color: '#9E9E9E' },
  accepted: { Icon: UserCheck, color: '#B57E0A' },
  declined: { Icon: UserX, color: '#9E9E9E' },
  started: { Icon: PlayCircle, color: '#B57E0A' },
  arrived_stop: { Icon: MapPin, color: '#2F80ED' },
  pickup_confirmed: { Icon: PackageCheck, color: '#2E7D32' },
  dropoff_confirmed: { Icon: HandCoins, color: '#2E7D32' },
  completed: { Icon: CircleCheck, color: '#4CAF50' },
  cancelled: { Icon: XCircle, color: '#C62828' },
};

export default async function TripDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) notFound();

  let trip: AdminTripDetail;
  try {
    trip = await apiFetch<AdminTripDetail>(`/admin/trips/${tripId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <Link
        href="/trips"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to trips
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold">
            {trip.originCity} → {trip.destinationCity}
          </h1>
          <div
            className="mt-1 flex items-center gap-3 text-sm flex-wrap"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            <span>#{trip.id}</span>
            <span>· {trip.type.replace('_', ' ')}</span>
            <span
              className="status-pill"
              style={{
                color: STATUS_COLOR[trip.status] ?? '#9E9E9E',
                border: `1px solid ${STATUS_COLOR[trip.status] ?? 'var(--color-sarfees-border)'}`,
              }}
            >
              {trip.status.replace('_', ' ')}
            </span>
            <span>· departs {new Date(trip.departureTime).toLocaleString()}</span>
          </div>
        </div>
        {(trip.status === 'accepted' || trip.status === 'in_progress') && (
          <CancelWithReason
            action={cancelTripAction}
            idFieldName="tripId"
            id={trip.id}
            label="Cancel trip"
            consequence="This kills the trip for everyone: all passenger requests and packages on it are cancelled and notified, and the driver is released without penalty. Blocked once someone has been picked up."
          />
        )}
      </div>

      {trip.cancellation && (
        <div
          className="mt-4 surface-card p-4 flex items-start gap-3"
          style={{ borderColor: 'rgba(198,40,40,0.35)' }}
        >
          <CircleAlert size={18} style={{ color: 'var(--color-sarfees-error)', marginTop: 2 }} />
          <div>
            <div className="font-extrabold" style={{ color: 'var(--color-sarfees-error)' }}>
              Cancelled (zone {trip.cancellation.zone})
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--color-sarfees-muted)' }}>
              {trip.cancellation.reason || '—'} · {new Date(trip.cancellation.cancelledAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* ─── Header tiles ───────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Stops" value={trip.summary.stopCount} />
        <Tile label="Passengers" value={trip.summary.passengerCount} />
        <Tile label="Packages" value={trip.summary.packageCount} />
        <Tile
          label="Cash collected / expected"
          value={`${Number(trip.totalCashCollected).toFixed(2)} / ${Number(
            trip.totalCashExpected,
          ).toFixed(2)} JD`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Driver card */}
        {trip.driver && (
          <div className="surface-card p-5">
            <h2
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              Driver
            </h2>
            <div className="mt-3">
              <Link href={`/drivers/${trip.driver.id}`} className="text-base font-extrabold">
                {trip.driver.name ?? `#${trip.driver.id}`}
              </Link>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-sarfees-muted)' }}>
                {trip.driver.phone}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
                <span>★ {Number(trip.driver.rating).toFixed(1)} ({trip.driver.ratingCount})</span>
                <span>· {trip.driver.totalTrips} trips</span>
              </div>
            </div>
          </div>
        )}

        {/* Pricing breakdown */}
        <div className="surface-card p-5 lg:col-span-2">
          <h2
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-sarfees-gold)' }}
          >
            Pricing breakdown
          </h2>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <PriceCell label="Expected" value={`${trip.pricing.totalCashExpected.toFixed(2)} JD`} />
            <PriceCell label="Collected" value={`${trip.pricing.totalCashCollected.toFixed(2)} JD`} />
            <PriceCell
              label="Commission rate"
              value={`${(trip.pricing.commissionRate * 100).toFixed(1)}%`}
            />
            <PriceCell
              label="Commission"
              value={`${trip.pricing.commissionAmount.toFixed(2)} JD`}
            />
            <PriceCell
              label="Net to driver"
              value={`${trip.pricing.netEarnings.toFixed(2)} JD`}
              highlight
            />
          </div>
        </div>
      </div>

      {/* ─── Lifecycle timeline ─────────────────────────────── */}
      <div className="mt-6 surface-card p-5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-sarfees-gold)' }}
        >
          Lifecycle ({trip.lifecycle.length} events)
        </h2>

        {trip.lifecycle.length === 0 ? (
          <p
            className="mt-3 text-sm"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            No lifecycle events recorded yet.
          </p>
        ) : (
          <ol className="mt-4 relative">
            <div
              aria-hidden
              className="absolute top-0 bottom-0"
              style={{
                left: 13,
                width: 1,
                backgroundColor: 'var(--color-sarfees-border)',
              }}
            />
            {trip.lifecycle.map((e, i) => {
              const meta = EVENT_META[e.kind] ?? { Icon: Clock, color: '#9E9E9E' };
              const Icon = meta.Icon;
              return (
                <li
                  key={`${e.kind}-${i}-${e.at}`}
                  className="relative pl-10 pb-4 last:pb-0"
                >
                  <span
                    className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: 'var(--color-sarfees-dark-3)',
                      border: `2px solid ${meta.color}`,
                    }}
                  >
                    <Icon size={14} style={{ color: meta.color }} />
                  </span>
                  <div className="text-sm font-extrabold">{e.label}</div>
                  <div
                    className="text-[11px]"
                    style={{ color: 'var(--color-sarfees-soft)' }}
                  >
                    {new Date(e.at).toLocaleString()}
                  </div>
                  {e.detail && (
                    <div
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-sarfees-muted)' }}
                    >
                      {e.detail}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* ─── Decline log ────────────────────────────────────── */}
      {trip.declineHistory.length > 0 && (
        <div className="mt-6 surface-card p-5">
          <h2
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-sarfees-gold)' }}
          >
            Decline history ({trip.declineHistory.length})
          </h2>
          <ul className="mt-3 text-sm space-y-2">
            {trip.declineHistory.map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2">
                  <PackageX size={14} style={{ color: 'var(--color-sarfees-warning)', marginTop: 3 }} />
                  <div>
                    <div className="font-semibold">
                      {d.reason}
                      {d.autoDeclined && (
                        <span
                          className="ml-2 text-[10px] uppercase tracking-widest"
                          style={{ color: 'var(--color-sarfees-warning)' }}
                        >
                          auto
                        </span>
                      )}
                    </div>
                    {d.notes && (
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: 'var(--color-sarfees-muted)' }}
                      >
                        {d.notes}
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--color-sarfees-soft)' }}
                >
                  {new Date(d.declinedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Stop-by-stop manifest ─────────────────────────── */}
      <div className="mt-6 surface-card p-5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-widest flex items-center gap-2"
          style={{ color: 'var(--color-sarfees-gold)' }}
        >
          <Flag size={12} /> Stop-by-stop manifest
        </h2>
        <p
          className="text-xs mt-1"
          style={{ color: 'var(--color-sarfees-muted)' }}
        >
          {trip.stops.length} stops · est {trip.summary.estimatedDurationMinutes} min ·
          commission {(trip.commissionRate * 100).toFixed(1)}%
        </p>

        <ol className="mt-4 space-y-3">
          {trip.stops.map((s) => (
            <li
              key={s.id}
              className="surface-elevated p-4"
              style={{
                borderLeft: `4px solid ${
                  s.status === 'confirmed'
                    ? '#4CAF50'
                    : s.status === 'arrived'
                      ? '#B57E0A'
                      : 'var(--color-sarfees-border)'
                }`,
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div
                    className="text-xs uppercase tracking-widest"
                    style={{ color: 'var(--color-sarfees-soft)' }}
                  >
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
                  <span className="status-pill">{s.status}</span>
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
      <div
        className="mt-1 text-xl font-extrabold"
        style={{ color: 'var(--color-sarfees-gold)' }}
      >
        {value}
      </div>
    </div>
  );
}

function PriceCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        {label}
      </div>
      <div
        className="mt-1 font-extrabold"
        style={{
          color: highlight ? 'var(--color-sarfees-gold)' : 'var(--color-sarfees-text)',
          fontSize: highlight ? 16 : 14,
        }}
      >
        {value}
      </div>
    </div>
  );
}
