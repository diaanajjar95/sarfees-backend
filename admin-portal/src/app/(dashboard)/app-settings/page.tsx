import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/auth';
import AppConfigForm, { type AppConfigRow } from './_AppConfigForm';

export const dynamic = 'force-dynamic';

export default async function AppSettingsPage() {
  const me = await getCurrentAdmin();
  if (me && me.role !== 'super_admin') redirect('/');

  const configs = await apiFetch<AppConfigRow[]>('/admin/app-config');
  const ordered = [...configs].sort((a) => (a.app === 'passenger' ? -1 : 1));

  return (
    <div>
      <h1 className="text-2xl font-extrabold">App settings</h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        Runtime control of both mobile apps — maintenance mode, force /
        optional updates, and store links. Served to the apps by
        <code> GET /app/init</code>.
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {ordered.map((c) => (
          <AppConfigForm key={c.app} config={c} />
        ))}
      </div>
    </div>
  );
}
