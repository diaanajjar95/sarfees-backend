import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/auth';
import { CreateAdminForm, ToggleActiveButton } from './_AdminForms';

export const dynamic = 'force-dynamic';

interface AdminRow {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  ops_manager: 'Ops manager',
  support: 'Support',
  finance: 'Finance',
  seller: 'Seller',
};

export default async function AdminsPage() {
  const me = await getCurrentAdmin();
  if (me && me.role !== 'super_admin') redirect('/');

  const admins = await apiFetch<AdminRow[]>('/admin/admins');

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Admin accounts</h1>
      <p className="mt-1 mb-5 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        Portal accounts, including sellers who distribute top-up cards.
        Role changes take effect on the account&apos;s next login.
      </p>

      <CreateAdminForm />

      <div className="mt-4 surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--color-sarfees-soft)' }}>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Last login</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-t" style={{ borderColor: 'var(--color-sarfees-border)' }}>
                <td className="px-5 py-3 font-semibold">{a.fullName ?? '—'}</td>
                <td className="px-5 py-3">{a.email}</td>
                <td className="px-5 py-3">{ROLE_LABEL[a.role] ?? a.role}</td>
                <td className="px-5 py-3">
                  <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ color: a.isActive ? '#2E7D32' : 'var(--color-sarfees-soft)', border: `1px solid ${a.isActive ? '#2E7D32' : 'var(--color-sarfees-soft)'}44` }}>
                    {a.isActive ? 'active' : 'disabled'}
                  </span>
                </td>
                <td className="px-5 py-3" style={{ color: 'var(--color-sarfees-muted)' }}>
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'never'}
                </td>
                <td className="px-5 py-3 text-right">
                  {a.id !== me?.id && <ToggleActiveButton id={a.id} isActive={a.isActive} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
