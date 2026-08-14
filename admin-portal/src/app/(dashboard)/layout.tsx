import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Route,
  Inbox,
  DollarSign,
  Map as MapIcon,
  Megaphone,
  Package,
  Sparkles,
  HelpCircle,
  LogOut,
  Boxes,
} from 'lucide-react';
import { getCurrentAdmin, logoutAction } from '@/lib/auth';

const NAV: {
  href: string;
  label: string;
  icon: typeof Users;
  disabled?: boolean;
}[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/map', label: 'Live map', icon: MapIcon },
  { href: '/passenger-requests', label: 'Passenger requests', icon: Inbox },
  { href: '/groups', label: 'Trip groups', icon: Boxes },
  { href: '/packages', label: 'Packages', icon: Package },
  { href: '/drivers', label: 'Drivers', icon: Users },
  { href: '/trips', label: 'Trips', icon: Route },
  { href: '/earnings', label: 'Earnings', icon: DollarSign },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
  { href: '/early-access', label: 'Early access', icon: Sparkles },
];

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

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon, disabled }) => (
            <Link
              key={href}
              href={disabled ? '#' : href}
              aria-disabled={disabled}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                disabled
                  ? 'cursor-not-allowed'
                  : 'hover:bg-[rgba(250,190,44,0.08)]'
              }`}
              style={{
                color: disabled
                  ? 'var(--color-sarfees-soft)'
                  : 'var(--color-sarfees-text)',
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
              {disabled && (
                <span
                  className="ml-auto text-[9px] uppercase tracking-widest"
                  style={{ color: 'var(--color-sarfees-soft)' }}
                >
                  soon
                </span>
              )}
            </Link>
          ))}
        </nav>

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
