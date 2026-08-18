import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import CancelWithReason from '../_components/CancelWithReason';
import { cancelPackageAction } from './actions';

export const dynamic = 'force-dynamic';

interface AdminPackageRow {
  id: number;
  status: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  departureCity: string | null;
  arrivalCity: string | null;
  packageSize: string;
  weightKg: number | null;
  packageDescription: string | null;
  urgent: boolean;
  isImmediate: boolean;
  pickupDate: string | null;
  deliveryFee: number;
  tripGroupId: number | null;
  cancellationReason: string | null;
  createdAt: string;
}

interface PackagesListResponse {
  data: AdminPackageRow[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  openCount: number;
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'PICKED_UP', label: 'Picked up' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_COLOR: Record<string, { fg: string; border: string }> = {
  PENDING: { fg: '#F57C00', border: 'rgba(245,124,0,0.35)' },
  MATCHED: { fg: '#B57E0A', border: 'rgba(250,190,44,0.35)' },
  PICKED_UP: { fg: '#2E7D32', border: 'rgba(46,125,50,0.35)' },
  IN_TRANSIT: { fg: '#2E7D32', border: 'rgba(46,125,50,0.35)' },
  DELIVERED: { fg: '#4CAF50', border: 'rgba(76,175,80,0.35)' },
  CANCELLED: { fg: '#C62828', border: 'rgba(198,40,40,0.35)' },
};

/** Statuses ops may still cancel — mirrors the backend guard. */
const CANCELLABLE = new Set(['PENDING', 'MATCHED']);

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function PackagesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = sp.status ?? '';
  const page = Number(sp.page ?? 1);

  const qs = new URLSearchParams({ limit: '20', page: String(page) });
  if (status) qs.set('status', status);

  let resp: PackagesListResponse | null = null;
  let error: string | null = null;
  try {
    resp = await apiFetch<PackagesListResponse>(
      `/admin/packages?${qs.toString()}`,
    );
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load packages';
  }

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Package requests</h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-sarfees-muted)' }}
          >
            Delivery requests created by senders. They ride the same matching
            engine as passenger trips.
          </p>
        </div>
        {resp && (
          <div className="surface-card px-4 py-3">
            <div
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              In flight
            </div>
            <div className="text-2xl font-extrabold">{resp.openCount}</div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/packages?status=${t.value}` : '/packages'}
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
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Sender</th>
              <th className="px-5 py-3">Receiver</th>
              <th className="px-5 py-3">Route</th>
              <th className="px-5 py-3">Package</th>
              <th className="px-5 py-3">Fee</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td
                  colSpan={9}
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
                  colSpan={9}
                  className="px-5 py-8 text-center"
                  style={{ color: 'var(--color-sarfees-muted)' }}
                >
                  No package requests in this state.
                </td>
              </tr>
            )}
            {resp?.data.map((p) => {
              const sc = STATUS_COLOR[p.status] ?? {
                fg: '#9E9E9E',
                border: 'var(--color-sarfees-border)',
              };
              return (
                <tr
                  key={p.id}
                  className="border-t align-top"
                  style={{ borderColor: 'var(--color-sarfees-border)' }}
                >
                  <td className="px-5 py-3 font-mono font-semibold">
                    #{p.id}
                    {p.urgent && (
                      <div className="mt-1">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                          style={{
                            color: '#EF5350',
                            border: '1px solid rgba(239,83,80,0.4)',
                          }}
                        >
                          URGENT
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-semibold">{p.senderName}</div>
                    <div
                      className="text-xs"
                      style={{ color: 'var(--color-sarfees-muted)' }}
                    >
                      {p.senderPhone}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-semibold">{p.receiverName}</div>
                    <div
                      className="text-xs"
                      style={{ color: 'var(--color-sarfees-muted)' }}
                    >
                      {p.receiverPhone}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold whitespace-nowrap">
                    {p.departureCity ?? '—'} → {p.arrivalCity ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    {p.packageSize}
                    {p.weightKg != null && ` · ${p.weightKg} kg`}
                    {p.packageDescription && (
                      <div
                        className="text-xs max-w-[180px] truncate"
                        style={{ color: 'var(--color-sarfees-muted)' }}
                        title={p.packageDescription}
                      >
                        {p.packageDescription}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {p.deliveryFee.toFixed(2)} JD
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="status-pill"
                      style={{ color: sc.fg, border: `1px solid ${sc.border}` }}
                    >
                      {p.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {p.cancellationReason && (
                      <div
                        className="mt-1 text-xs max-w-[180px]"
                        style={{ color: 'var(--color-sarfees-muted)' }}
                      >
                        {p.cancellationReason}
                      </div>
                    )}
                  </td>
                  <td
                    className="px-5 py-3 whitespace-nowrap text-xs"
                    style={{ color: 'var(--color-sarfees-muted)' }}
                  >
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    {CANCELLABLE.has(p.status) && (
                      <CancelWithReason
                        action={cancelPackageAction}
                        idFieldName="packageId"
                        id={p.id}
                        label="Cancel"
                        consequence="Cancels this delivery and notifies the sender path. If it was the last live member of its trip group, the group closes too."
                      />
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
            Page {resp.page} / {resp.totalPages} · {resp.totalItems} deliveries
          </span>
          {resp.page > 1 && (
            <Link
              href={`/packages?status=${status}&page=${resp.page - 1}`}
              style={{ color: 'var(--color-sarfees-gold)' }}
            >
              ← Prev
            </Link>
          )}
          {resp.page < resp.totalPages && (
            <Link
              href={`/packages?status=${status}&page=${resp.page + 1}`}
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
