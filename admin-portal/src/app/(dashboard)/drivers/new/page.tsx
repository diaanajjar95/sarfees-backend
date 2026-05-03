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
        Once created, the driver can sign in immediately via the OTP flow on the mobile app.
      </p>
      <div className="mt-6">
        <DriverForm action={createDriverAction} submitLabel="Create driver" />
      </div>
    </div>
  );
}
