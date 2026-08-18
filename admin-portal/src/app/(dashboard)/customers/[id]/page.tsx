import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface TripRow {
  id: number;
  route: string;
  status: string;
  travelDate: string | null;
  seats: number;
  totalFare: number;
  driverName: string | null;
  createdAt: string;
}

interface RatingRow {
  id: number;
  tripRequestId: number;
  driverName: string | null;
  level: string;
  value: number;
  comment: string | null;
  createdAt: string;
}

interface CustomerDetail {
  id: number;
  name: string | null;
  countryCode: string | null;
  phoneNumber: string;
  email: string | null;
  gender: string | null;
  rating: number;
  ratingCount: number;
  isProfileCompleted: boolean;
  createdAt: string;
  trips: TripRow[];
  ratingsReceived: RatingRow[];
  ratingsGiven: RatingRow[];
}

const LEVEL_LABEL: Record<string, string> = {
  excellent: 'Excellent',
  very_good: 'Very good',
  good: 'Good',
  not_bad: 'Not bad',
  bad: 'Bad',
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();

  let c: CustomerDetail;
  try {
    c = await apiFetch<CustomerDetail>(`/admin/customers/${customerId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to customers
      </Link>

      <div className="mt-2">
        <h1 className="text-2xl font-extrabold">{c.name ?? `Customer #${c.id}`}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm flex-wrap" style={{ color: 'var(--color-sarfees-muted)' }}>
          <span>★ {Number(c.rating).toFixed(2)} ({c.ratingCount} rating{c.ratingCount === 1 ? '' : 's'})</span>
          <span>{c.countryCode} {c.phoneNumber}</span>
          {c.gender && <span>{c.gender}</span>}
          {c.email && <span>{c.email}</span>}
          <span>member since {new Date(c.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="mt-6 surface-card p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-sarfees-gold)' }}>
          Trip history ({c.trips.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          {c.trips.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>No trips yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-widest text-left" style={{ color: 'var(--color-sarfees-soft)' }}>
                  <th className="py-2">Route</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Driver</th>
                  <th className="py-2">Seats</th>
                  <th className="py-2 text-right">Fare</th>
                  <th className="py-2 text-right">Travel date</th>
                </tr>
              </thead>
              <tbody>
                {c.trips.map((t) => (
                  <tr key={t.id} className="border-t" style={{ borderColor: 'var(--color-sarfees-border)' }}>
                    <td className="py-2 font-semibold">
                      <Link href={`/passenger-requests/${t.id}`} className="hover:underline">
                        {t.route}
                      </Link>
                    </td>
                    <td className="py-2">
                      <span className={`status-pill ${t.status.toLowerCase()}`}>
                        {t.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="py-2">{t.driverName ?? '—'}</td>
                    <td className="py-2">{t.seats}</td>
                    <td className="py-2 text-right">{Number(t.totalFare).toFixed(2)} JD</td>
                    <td className="py-2 text-right" style={{ color: 'var(--color-sarfees-muted)' }}>
                      {t.travelDate ? new Date(t.travelDate).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RatingsCard
          title={`Ratings received from drivers (${c.ratingsReceived.length})`}
          rows={c.ratingsReceived}
          who="From"
        />
        <RatingsCard
          title={`Ratings given to drivers (${c.ratingsGiven.length})`}
          rows={c.ratingsGiven}
          who="To"
        />
      </div>
    </div>
  );
}

function RatingsCard({ title, rows, who }: { title: string; rows: RatingRow[]; who: string }) {
  return (
    <div className="surface-card p-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-sarfees-gold)' }}>
        {title}
      </h2>
      <div className="mt-3 space-y-3">
        {rows.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>None yet.</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="border-t pt-3 first:border-t-0 first:pt-0 text-sm" style={{ borderColor: 'var(--color-sarfees-border)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                {'★'.repeat(r.value)}{'☆'.repeat(5 - r.value)}{' '}
                {LEVEL_LABEL[r.level] ?? r.level}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-0.5 text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
              {who} {r.driverName ?? 'driver'} · trip request #{r.tripRequestId}
            </div>
            {r.comment && (
              <p className="mt-1 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--color-sarfees-dark-3)', color: 'var(--color-sarfees-muted)' }}>
                “{r.comment}”
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
