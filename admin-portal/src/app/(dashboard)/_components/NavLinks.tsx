'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BellRing,
  Boxes,
  DollarSign,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Map as MapIcon,
  Megaphone,
  Package,
  Route,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

const NAV: NavEntry[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/map', label: 'Live map', icon: MapIcon },
  { href: '/passenger-requests', label: 'Passenger requests', icon: Inbox },
  { href: '/groups', label: 'Trip groups', icon: Boxes },
  { href: '/packages', label: 'Packages', icon: Package },
  { href: '/drivers', label: 'Drivers', icon: Users },
  { href: '/customers', label: 'Customers', icon: UsersRound },
  { href: '/trips', label: 'Trips', icon: Route },
  { href: '/earnings', label: 'Earnings', icon: DollarSign },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
  { href: '/early-access', label: 'Early access', icon: Sparkles },
  { href: '/notifications', label: 'Notifications', icon: BellRing },
];

/**
 * Sidebar nav with the mockup's active-route treatment: the current
 * section gets the amber surface chip; everything else is quiet text.
 */
export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
      {NAV.map(({ href, label, icon: Icon, disabled }) => {
        const active =
          href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={disabled ? '#' : href}
            aria-disabled={disabled}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              disabled ? 'cursor-not-allowed' : ''
            }`}
            style={{
              backgroundColor: active
                ? 'var(--color-sarfees-gold-surface)'
                : 'transparent',
              color: disabled
                ? 'var(--color-sarfees-soft)'
                : active
                  ? 'var(--color-sarfees-gold)'
                  : 'var(--color-sarfees-muted)',
              fontWeight: active ? 800 : 600,
            }}
          >
            <Icon size={17} />
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
        );
      })}
    </nav>
  );
}
