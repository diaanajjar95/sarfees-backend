import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface EarlyAccessRow {
  id: number;
  role: 'passenger' | 'driver';
  route: string | null;
  frequency: string | null;
  travelTime: string | null;
  fairPriceJod: number | null;
  findMethod: string | null;
  pilotWilling: string | null;
  phone: string | null;
  locale: string | null;
  createdAt: string;
}

interface EarlyAccessListResponse {
  data: EarlyAccessRow[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  passengerCount: number;
  driverCount: number;
}

const ROLE_TABS = [
  { value: '', label: 'All' },
  { value: 'passenger', label: 'Passengers' },
  { value: 'driver', label: 'Drivers' },
];

const CHIP_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  'few-times': 'Few times / month',
  rarely: 'Rarely',
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  evening: 'Evening',
  whatsapp: 'WhatsApp group',
  'own-base': 'Own passengers',
  other: 'Other',
};

const PILOT_COLOR: Record<string, string> = {
  yes: '#4CAF50',
  maybe: '#F57C00',
  no: '#9090A0',
};

interface PageProps {
  searchParams: Promise<{ role?: string; page?: string }>;
}

export default async function EarlyAccessPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const role = sp.role ?? '';
  const page = Number(sp.page ?? 1);

  const qs = new URLSearchParams({ limit: '20', page: String(page) });
  if (role) qs.set('role', role);

  let resp: EarlyAccessListResponse | null = null;
  let error: string | null = null;
  try {
    resp = await apiFetch<EarlyAccessListResponse>(
      `/admin/early-access?${qs.toString()}`,
    );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load signups';
  }

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Early access</h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            Pre-launch &ldquo;Join Early&rdquo; registrations from the landing
            page. Rows with a phone number said yes/maybe to pilot trips.
          </p>
        </div>
        {resp && (
          <div className="flex gap-3">
            <div className="surface-card px-4 py-3">
              <div
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-sarfees-gold)' }}
              >
                Passengers
              </div>
              <div className="text-2xl font-extrabold">
                {resp.passengerCount}
              </div>
            </div>
            <div className="surface-card px-4 py-3">
              <div
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-sarfees-gold)' }}
              >
                Drivers
              </div>
              <div className="text-2xl font-extrabold">{resp.driverCount}</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        {ROLE_TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/early-access?role=${t.value}` : '/early-access'}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{
              borderColor:
                role === t.value
                  ? 'var(--color-sarfees-gold)'
                  : 'var(--color-sarfees-border)',
              color:
                role === t.value
                  ? 'var(--color-sarfees-gold)'
                  : 'var(--color-sarfees-muted)',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-wide"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Route</th>
              <th className="px-5 py-3">Details</th>
              <th className="px-5 py-3">Pilot</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Lang</th>
              <th className="px-5 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-4 text-sm"
                  style={{ color: 'var(--color-sarfees-error)' }}
                >
                  {error}
                </td>
              </tr>
            )}
            {resp && resp.data.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center"
                  style={{ color: 'var(--color-sarfees-muted)' }}
                >
                  No signups yet.
                </td>
              </tr>
            )}
            {resp?.data.map((r) => (
              <tr
                key={r.id}
                className="border-t align-top"
                style={{ borderColor: 'var(--color-sarfees-border)' }}
              >
                <td className="px-5 py-3 font-mono font-semibold">#{r.id}</td>
                <td className="px-5 py-3">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-bold capitalize"
                    style={
                      r.role === 'driver'
                        ? {
                            color: 'var(--color-sarfees-gold)',
                            border: '1px solid rgba(250,190,44,0.4)',
                          }
                        : {
                            color: '#64B5F6',
                            border: '1px solid rgba(100,181,246,0.4)',
                          }
                    }
                  >
                    {r.role}
                  </span>
                </td>
                <td className="px-5 py-3 font-semibold">{r.route ?? '—'}</td>
                <td
                  className="px-5 py-3 text-xs"
                  style={{ color: 'var(--color-sarfees-muted)' }}
                >
                  {[
                    r.frequency && `Travels: ${CHIP_LABEL[r.frequency] ?? r.frequency}`,
                    r.travelTime && `Time: ${CHIP_LABEL[r.travelTime] ?? r.travelTime}`,
                    r.fairPriceJod !== null && `Fair price: ${r.fairPriceJod} JD`,
                    r.findMethod && `Finds riders via: ${CHIP_LABEL[r.findMethod] ?? r.findMethod}`,
                  ]
                    .filter(Boolean)
                    .map((line) => <div key={String(line)}>{line}</div>)}
                  {!r.frequency &&
                    !r.travelTime &&
                    r.fairPriceJod === null &&
                    !r.findMethod &&
                    '—'}
                </td>
                <td className="px-5 py-3">
                  {r.pilotWilling ? (
                    <span
                      className="text-xs font-bold capitalize"
                      style={{ color: PILOT_COLOR[r.pilotWilling] ?? '#9090A0' }}
                    >
                      {r.pilotWilling}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-5 py-3 font-mono">{r.phone ?? '—'}</td>
                <td className="px-5 py-3 uppercase text-xs">
                  {r.locale ?? '—'}
                </td>
                <td
                  className="px-5 py-3 whitespace-nowrap"
                  style={{ color: 'var(--color-sarfees-muted)' }}
                >
                  {new Date(r.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resp && resp.totalPages > 1 && (
        <div
          className="mt-3 flex items-center gap-3 text-sm"
          style={{ color: 'var(--color-sarfees-muted)' }}
        >
          <span>
            Page {resp.page} / {resp.totalPages} · {resp.totalItems} signups
          </span>
          {resp.page > 1 && (
            <Link
              href={`/early-access?role=${role}&page=${resp.page - 1}`}
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              ← Prev
            </Link>
          )}
          {resp.page < resp.totalPages && (
            <Link
              href={`/early-access?role=${role}&page=${resp.page + 1}`}
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
