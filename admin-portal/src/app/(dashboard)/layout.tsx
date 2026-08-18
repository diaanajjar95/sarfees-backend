import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { getCurrentAdmin, logoutAction } from '@/lib/auth';
import NavLinks from './_components/NavLinks';



export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  return (
    <div className="min-h-screen flex">
      <aside
        className="w-64 shrink-0 flex flex-col"
        style={{
          backgroundColor: 'var(--color-sarfees-dark-2)',
          borderRight: '1px solid var(--color-sarfees-border)',
        }}
      >
        <div
          className="px-5 py-5"
          style={{ borderBottom: '1px solid var(--color-sarfees-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-extrabold"
              style={{
                backgroundColor: 'var(--color-sarfees-gold)',
                color: '#1A1A1A',
              }}
            >
              S
            </div>
            <div>
              <div className="text-base font-extrabold">Sarfees</div>
              <div
                className="text-[10px] uppercase tracking-widest"
                style={{ color: 'var(--color-sarfees-soft)' }}
              >
                Admin Console
              </div>
            </div>
          </div>
        </div>

        <NavLinks />

        {admin && (
          <div
            className="p-4"
            style={{ borderTop: '1px solid var(--color-sarfees-border)' }}
          >
            <div className="text-sm font-semibold">
              {admin.fullName ?? admin.email}
            </div>
            <div
              className="text-xs"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              {admin.role.replace('_', ' ')}
            </div>
            <form action={logoutAction} className="mt-3">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 text-xs font-semibold py-2 rounded-md"
                style={{
                  color: 'var(--color-sarfees-muted)',
                  border: '1px solid var(--color-sarfees-border)',
                }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </form>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
