import { getCurrencySymbol } from '@/lib/currency';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import type { PassengerRequestRow } from '@/lib/types';
import CancelWithReason from '../../_components/CancelWithReason';
import { cancelRequestAction } from '../actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PassengerRequestDetailPage({ params }: PageProps) {
  const cur = await getCurrencySymbol();
  const { id } = await params;
  const reqId = Number(id);
  if (!Number.isFinite(reqId)) notFound();

  let req: PassengerRequestRow;
  try {
    req = await apiFetch<PassengerRequestRow>(`/admin/passenger-requests/${reqId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const isPending = req.status === 'PENDING';

  // Build the assign deeplink — prefills /trips/new with everything we know.
  const assignParams = new URLSearchParams({
    tripRequestIds: String(req.id),
    type: req.isFemaleOnly ? 'women_only' : 'shared',
    originCity: req.departureCity ?? '',
    destinationCity: req.arrivalCity ?? '',
    departureTime: toDatetimeLocal(
      req.travelDate ? new Date(req.travelDate) : new Date(),
    ),
    pickupLat: String(req.departureLat),
    pickupLng: String(req.departureLng),
    dropoffLat: String(req.arrivalLat),
    dropoffLng: String(req.arrivalLng),
  });
  const assignHref = `/trips/new?${assignParams.toString()}`;

  return (
    <div>
      <Link
        href="/passenger-requests"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to passenger requests
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold">Request #{req.id}</h1>
          <div
            className="mt-1 flex items-center gap-3 text-sm flex-wrap"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            <span className="status-pill">{req.status.replace(/_/g, ' ').toLowerCase()}</span>
            <span>{req.passengerName} · {req.passengerPhone}</span>
            <span>· created {new Date(req.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-start gap-2 flex-wrap">
          {isPending && (
            <Link href={assignHref} className="btn-primary">
              Assign to driver →
            </Link>
          )}
          {req.status !== 'CANCELLED' && req.status !== 'COMPLETED' && (
            <CancelWithReason
              action={cancelRequestAction}
              idFieldName="requestId"
              id={req.id}
              label="Cancel request"
              consequence="Cancels this passenger's request and updates their trip group. The reason is stored for audit."
            />
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DataCard title="Route">
          <Row label="From" value={`${req.departureCity ?? '—'}`} />
          <Row label="To" value={`${req.arrivalCity ?? '—'}`} />
          <Row label="Pickup coords" value={`${req.departureLat}, ${req.departureLng}`} />
          <Row label="Dropoff coords" value={`${req.arrivalLat}, ${req.arrivalLng}`} />
        </DataCard>

        <DataCard title="Trip">
          <Row
            label="Departure"
            value={
              req.travelDate
                ? new Date(req.travelDate).toLocaleString()
                : 'Immediate'
            }
          />
          <Row label="Immediate?" value={req.isImmediate ? 'Yes' : 'No'} />
          <Row label="Seats" value={req.seatsCount} />
          <Row
            label="Women-only"
            value={req.isFemaleOnly ? 'Yes' : 'No'}
          />
        </DataCard>

        <DataCard title="Pricing & assignment">
          <Row label="Per-seat fare" value={`${Number(req.perSeatFare).toFixed(2)} ${cur}`} />
          <Row label="Total fare" value={`${Number(req.totalFare).toFixed(2)} ${cur}`} />
          <Row label="Passenger gender" value={req.passengerGender ?? '—'} />
          <Row
            label="Driver"
            value={
              req.driverName ? (
                <Link href={`/drivers/${req.driverId}`}>{req.driverName}</Link>
              ) : (
                <span style={{ color: 'var(--color-sarfees-soft)' }}>Unassigned</span>
              )
            }
          />
        </DataCard>
      </div>

      {isPending && (
        <div className="mt-6 surface-card p-5">
          <h2
            className="text-[11px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--color-sarfees-gold)' }}
          >
            Why is this still pending?
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
            The auto-matcher couldn&apos;t find an active driver whose preferences
            (destination city / trip types / women-only / min passengers) accept
            this trip. Use the <strong style={{ color: 'var(--color-sarfees-text)' }}>Assign to driver</strong> button above
            to manually offer it to any driver.
          </p>
        </div>
      )}
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

/**
 * Format for a datetime-local input in SERVER-LOCAL time (the portal
 * container runs TZ=Asia/Amman). toISOString() must never be used here:
 * it renders UTC, which shifted manual-trip departures by -3h.
 */
function toDatetimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
