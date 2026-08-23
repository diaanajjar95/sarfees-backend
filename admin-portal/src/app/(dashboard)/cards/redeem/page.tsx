import { getCurrencySymbol } from '@/lib/currency';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import RedeemFlow from './_RedeemFlow';

export const dynamic = 'force-dynamic';

export default async function RedeemPage() {
  const cur = await getCurrencySymbol();
  const me = await getCurrentAdmin();
  if (me && !['super_admin', 'seller'].includes(me.role)) redirect('/');

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Redeem a card</h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        The driver pays you cash. Enter their mobile number, confirm the
        name, then enter the card code — the wallet credits instantly.
      </p>
      <RedeemFlow currency={cur} />
    </div>
  );
}
