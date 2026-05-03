import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { DriverListResponse, DriverTripType } from '@/lib/types';
import ManualAssignForm, { type Prefill } from './_ManualAssignForm';

interface PageProps {
  searchParams: Promise<{
    tripRequestIds?: string;
    type?: DriverTripType;
    originCity?: string;
    destinationCity?: string;
    departureTime?: string;
    pickupLat?: string;
    pickupLng?: string;
    dropoffLat?: string;
    dropoffLng?: string;
  }>;
}

export default async function NewTripPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const prefill: Prefill = {
    tripRequestIds: sp.tripRequestIds,
    type: sp.type,
    originCity: sp.originCity,
    destinationCity: sp.destinationCity,
    departureTime: sp.departureTime,
    pickupLat: sp.pickupLat,
    pickupLng: sp.pickupLng,
    dropoffLat: sp.dropoffLat,
    dropoffLng: sp.dropoffLng,
  };

  let drivers: DriverListResponse | null = null;
  try {
    drivers = await apiFetch<DriverListResponse>(
      '/admin/drivers?limit=200',
    );
  } catch {
    drivers = null;
  }

  const linkedRequest = sp.tripRequestIds?.split(',')[0];

  return (
    <div className="max-w-3xl">
      <Link
        href={
          linkedRequest
            ? `/passenger-requests/${linkedRequest}`
            : '/trips'
        }
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} />{' '}
        {linkedRequest ? `Back to request #${linkedRequest}` : 'Back to trips'}
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold">Manual trip assignment</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        Builds an OFFERED trip from existing passenger trip-request rows. Driver gets a 45s offer
        (configurable). The driver accepts or declines through the mobile app.
      </p>

      {linkedRequest && (
        <div
          className="mt-3 rounded-md px-3 py-2 text-xs"
          style={{
            color: 'var(--color-sarfees-gold)',
            backgroundColor: 'rgba(250,190,44,0.08)',
            border: '1px solid rgba(250,190,44,0.25)',
          }}
        >
          Pre-filled from passenger request <strong>#{linkedRequest}</strong>. You only need to pick a driver.
        </div>
      )}

      <div className="mt-6">
        <ManualAssignForm drivers={drivers?.data ?? []} prefill={prefill} />
      </div>
    </div>
  );
}
