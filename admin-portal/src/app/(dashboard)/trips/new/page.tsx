import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { DriverListResponse } from '@/lib/types';
import ManualAssignForm from './_ManualAssignForm';

export default async function NewTripPage() {
  let drivers: DriverListResponse | null = null;
  try {
    drivers = await apiFetch<DriverListResponse>(
      '/admin/drivers?limit=200',
    );
  } catch {
    drivers = null;
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/trips"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to trips
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold">Manual trip assignment</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        Builds an OFFERED trip from existing passenger trip-request rows. Driver gets a 45s offer
        (configurable). The driver accepts or declines through the mobile app.
      </p>

      <div className="mt-6">
        <ManualAssignForm drivers={drivers?.data ?? []} />
      </div>
    </div>
  );
}
