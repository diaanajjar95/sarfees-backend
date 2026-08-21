import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/auth';
import SettingsForm from './_SettingsForm';

export const dynamic = 'force-dynamic';

interface WalletConfig {
  commissionPercent: number;
  lowBalanceThresholdJod: number;
  lowBalanceNotifyCooldownHours: number;
  updatedAt: string;
}

export default async function WalletSettingsPage() {
  const me = await getCurrentAdmin();
  if (me && !['super_admin', 'finance'].includes(me.role)) redirect('/');

  const cfg = await apiFetch<WalletConfig>('/admin/wallet-config');

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Wallet settings</h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        Platform commission and driver low-balance warning. Last changed{' '}
        {new Date(cfg.updatedAt).toLocaleString()}.
      </p>
      <SettingsForm
        commissionPercent={Number(cfg.commissionPercent)}
        lowBalanceThresholdJod={Number(cfg.lowBalanceThresholdJod)}
        readOnly={me?.role !== 'super_admin'}
      />
    </div>
  );
}
