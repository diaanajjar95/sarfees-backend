import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import DriverForm from '../_DriverForm';
import { createDriverAction } from '../actions';

export default function NewDriverPage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/drivers"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to drivers
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold">New driver</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        Step 1 of 2 — after saving you land on the driver's page to upload their documents (license, ID, vehicle registration, insurance). The driver can sign in immediately via the OTP flow.
      </p>
      <div className="mt-6">
        <DriverForm action={createDriverAction} submitLabel="Create driver" />
      </div>
    </div>
  );
}
