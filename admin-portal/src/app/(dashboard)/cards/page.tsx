import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HandCoins } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/auth';
import { GenerateBatchForm } from './_CardForms';

export const dynamic = 'force-dynamic';

interface BatchRow {
  batchId: string;
  createdAt: string;
  amount: number;
  total: number;
  available: number;
  redeemed: number;
}

interface CardRow {
  id: number;
  codeMasked: string;
  batchId: string;
  amount: number;
  status: string;
  redeemedAt: string | null;
  redeemedForDriverName: string | null;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  available: '#2E7D32',
  redeemed: '#B57E0A',
  void: '#9E9E9E',
};

export default async function CardsPage() {
  const me = await getCurrentAdmin();
  if (me && !['super_admin', 'seller'].includes(me.role)) redirect('/');

  const [batches, cards] = await Promise.all([
    apiFetch<BatchRow[]>('/admin/cards/batches').catch(() => []),
    apiFetch<{ data: CardRow[] }>('/admin/cards?limit=30').catch(() => ({ data: [] })),
  ]);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Top-up cards</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
            Prepaid wallet cards. A driver pays you cash, you redeem a card
            onto their wallet with their mobile number.
          </p>
        </div>
        <Link href="/cards/redeem" className="btn-primary inline-flex items-center gap-2">
          <HandCoins size={16} /> Redeem for a driver
        </Link>
      </div>

      <div className="mt-4">
        <GenerateBatchForm />
      </div>

      <div className="mt-4 surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--color-sarfees-soft)' }}>
              <th className="px-5 py-3">Batch</th>
              <th className="px-5 py-3">Value</th>
              <th className="px-5 py-3">Cards</th>
              <th className="px-5 py-3">Available</th>
              <th className="px-5 py-3">Redeemed</th>
              <th className="px-5 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-center" style={{ color: 'var(--color-sarfees-muted)' }}>No batches yet — generate your first above.</td></tr>
            )}
            {batches.map((b) => (
              <tr key={b.batchId} className="border-t" style={{ borderColor: 'var(--color-sarfees-border)' }}>
                <td className="px-5 py-3 font-mono">{b.batchId.slice(0, 8)}</td>
                <td className="px-5 py-3 font-semibold">{Number(b.amount).toFixed(2)} JD</td>
                <td className="px-5 py-3">{b.total}</td>
                <td className="px-5 py-3" style={{ color: '#2E7D32' }}>{b.available}</td>
                <td className="px-5 py-3" style={{ color: '#B57E0A' }}>{b.redeemed}</td>
                <td className="px-5 py-3" style={{ color: 'var(--color-sarfees-muted)' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--color-sarfees-soft)' }}>
              <th className="px-5 py-3">Card</th>
              <th className="px-5 py-3">Value</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Redeemed for</th>
              <th className="px-5 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {cards.data.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-sarfees-border)' }}>
                <td className="px-5 py-3 font-mono">{c.codeMasked}</td>
                <td className="px-5 py-3">{Number(c.amount).toFixed(2)} JD</td>
                <td className="px-5 py-3">
                  <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ color: STATUS_COLOR[c.status] ?? '#9E9E9E', border: `1px solid ${STATUS_COLOR[c.status] ?? '#9E9E9E'}44` }}>
                    {c.status}
                  </span>
                </td>
                <td className="px-5 py-3">{c.redeemedForDriverName ?? '—'}</td>
                <td className="px-5 py-3" style={{ color: 'var(--color-sarfees-muted)' }}>
                  {c.redeemedAt ? new Date(c.redeemedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
