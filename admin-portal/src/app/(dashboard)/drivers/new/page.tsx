import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import RegistrationWizard from '../_RegistrationWizard';

export default function NewDriverPage() {
  return (
    <div className="max-w-4xl">
      <Link
        href="/drivers"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to drivers
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold">New driver</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        Four steps — driver, vehicle, attachments, confirm. The driver can sign in immediately via the OTP flow once created.
      </p>
      <div className="mt-6">
        <RegistrationWizard />
      </div>
    </div>
  );
}
