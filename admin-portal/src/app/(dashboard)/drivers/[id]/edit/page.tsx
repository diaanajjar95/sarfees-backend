import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import type { DriverProfile } from '@/lib/types';
import DriverForm from '../../_DriverForm';
import { updateDriverAction, type DriverFormState } from '../../actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDriverPage({ params }: PageProps) {
  const { id } = await params;
  const driverId = Number(id);
  if (!Number.isFinite(driverId)) notFound();

  let driver: DriverProfile;
  try {
    driver = await apiFetch<DriverProfile>(`/admin/drivers/${driverId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Bind driverId into the server action so the form receives the right signature.
  const action = async (
    prev: DriverFormState | null,
    formData: FormData,
  ): Promise<DriverFormState> => {
    'use server';
    return updateDriverAction(driverId, prev, formData);
  };

  return (
    <div className="max-w-3xl">
      <Link
        href={`/drivers/${driverId}`}
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to driver
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold">Edit driver</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        Phone number and country code are immutable. Suspend / reinstate from the detail page.
      </p>
      <div className="mt-6">
        <DriverForm
          initial={driver}
          action={action}
          submitLabel="Save changes"
          isEdit
        />
      </div>
    </div>
  );
}
