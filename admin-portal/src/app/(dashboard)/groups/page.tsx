import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface TripGroupMember {
  requestId: number;
  passengerName: string;
  passengerPhone: string;
  seatsCount: number;
  requestStatus: string;
}

interface TripGroupRow {
  id: number;
  status: string;
  originCity: string;
  destCity: string;
  departureTime: string;
  driverSearchAt: string;
  frozenAt: string | null;
  womenOnly: boolean;
  fullCar: boolean;
  urgent: boolean;
  totalSeats: number;
  memberCount: number;
  members: TripGroupMember[];
  createdAt: string;
}

interface TripGroupsListResponse {
  data: TripGroupRow[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  unassignedCount: number;
}

const STATUS_TABS = [
  { value: 'unassigned', label: 'Waiting for driver' },
  { value: 'open', label: 'Open' },
  { value: 'unserved_escalation', label: 'Escalated' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'all', label: 'All' },
];

const STATUS_COLOR: Record<string, { fg: string; border: string }> = {
  open: { fg: '#2F80ED', border: 'rgba(47,128,237,0.35)' },
  frozen: { fg: '#F57C00', border: 'rgba(245,124,0,0.35)' },
  offering: { fg: '#FABE2C', border: 'rgba(250,190,44,0.35)' },
  broadcasting: { fg: '#FABE2C', border: 'rgba(250,190,44,0.35)' },
  assigned: { fg: '#4CAF50', border: 'rgba(76,175,80,0.35)' },
  in_progress: { fg: '#2E7D32', border: 'rgba(46,125,50,0.35)' },
  completed: { fg: '#4CAF50', border: 'rgba(76,175,80,0.35)' },
  cancelled: { fg: '#C62828', border: 'rgba(198,40,40,0.35)' },
  unserved_escalation: { fg: '#C62828', border: 'rgba(198,40,40,0.35)' },
};

function fmtCountdown(toIso: string): string {
  const ms = new Date(toIso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const m = Math.round(ms / 60000);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  return `in ${h}h ${m % 60}m`;
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function TripGroupsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status ?? 'unassigned';
  const page = Number(sp.page ?? 1);

  const qs = new URLSearchParams({ limit: '20', page: String(page), status });

  let resp: TripGroupsListResponse | null = null;
  let error: string | null = null;
  try {
    resp = await apiFetch<TripGroupsListResponse>(
      `/admin/trip-groups?${qs.toString()}`,
    );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load trip groups';
  }

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Trip groups</h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            Stage-1 grouping output. Driver search starts automatically at
            T-30 min before departure — groups here are still waiting.
          </p>
        </div>
        {resp && (
          <div className="surface-card px-4 py-3">
            <div
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              Waiting for driver
            </div>
            <div className="text-2xl font-extrabold">
              {resp.unassignedCount}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value}
            href={`/groups?status=${t.value}`}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{
              borderColor:
                status === t.value
                  ? 'var(--color-sarfees-gold)'
                  : 'var(--color-sarfees-border)',
              color:
                status === t.value
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
              <th className="px-5 py-3">Group</th>
              <th className="px-5 py-3">Corridor</th>
              <th className="px-5 py-3">Departure</th>
              <th className="px-5 py-3">Driver search</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Seats</th>
              <th className="px-5 py-3">Members</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td
                  colSpan={7}
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
                  colSpan={7}
                  className="px-5 py-8 text-center"
                  style={{ color: 'var(--color-sarfees-muted)' }}
                >
                  No trip groups in this state.
                </td>
              </tr>
            )}
            {resp?.data.map((g) => {
              const sc = STATUS_COLOR[g.status] ?? {
                fg: '#9090A0',
                border: 'var(--color-sarfees-border)',
              };
              return (
                <tr
                  key={g.id}
                  className="border-t align-top"
                  style={{ borderColor: 'var(--color-sarfees-border)' }}
                >
                  <td className="px-5 py-3 font-mono font-semibold">
                    #{g.id}
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {g.womenOnly && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                          style={{
                            color: '#CE93D8',
                            border: '1px solid rgba(206,147,216,0.4)',
                          }}
                        >
                          WOMEN-ONLY
                        </span>
                      )}
                      {g.fullCar && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                          style={{
                            color: '#90CAF9',
                            border: '1px solid rgba(144,202,249,0.4)',
                          }}
                        >
                          FULL CAR
                        </span>
                      )}
                      {g.urgent && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                          style={{
                            color: '#EF5350',
                            border: '1px solid rgba(239,83,80,0.4)',
                          }}
                        >
                          URGENT
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold">
                    {g.originCity} → {g.destCity}
                  </td>
                  <td className="px-5 py-3">
                    {new Date(g.departureTime).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    {g.frozenAt ? (
                      <span style={{ color: 'var(--color-sarfees-muted)' }}>
                        started{' '}
                        {new Date(g.frozenAt).toLocaleTimeString()}
                      </span>
                    ) : (
                      <span style={{ color: '#F57C00' }}>
                        {fmtCountdown(g.driverSearchAt)}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="status-pill"
                      style={{ color: sc.fg, border: `1px solid ${sc.border}` }}
                    >
                      {g.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">{g.totalSeats}</td>
                  <td className="px-5 py-3">
                    {g.members.map((m) => (
                      <div key={m.requestId} className="whitespace-nowrap">
                        <Link
                          href={`/passenger-requests/${m.requestId}`}
                          style={{ color: 'var(--color-sarfees-gold)' }}
                        >
                          #{m.requestId}
                        </Link>{' '}
                        {m.passengerName}
                        <span
                          className="ml-1 text-xs"
                          style={{ color: 'var(--color-sarfees-muted)' }}
                        >
                          {m.passengerPhone} · {m.seatsCount} seat
                          {m.seatsCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                    {g.members.length === 0 && (
                      <span style={{ color: 'var(--color-sarfees-muted)' }}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {resp && resp.totalPages > 1 && (
        <div
          className="mt-3 flex items-center gap-3 text-sm"
          style={{ color: 'var(--color-sarfees-muted)' }}
        >
          <span>
            Page {resp.page} / {resp.totalPages} · {resp.totalItems} groups
          </span>
          {resp.page > 1 && (
            <Link
              href={`/groups?status=${status}&page=${resp.page - 1}`}
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              ← Prev
            </Link>
          )}
          {resp.page < resp.totalPages && (
            <Link
              href={`/groups?status=${status}&page=${resp.page + 1}`}
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
