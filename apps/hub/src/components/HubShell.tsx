'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppShell, RailItem, ContentPane } from '@portico/ui/shell';
import { IconHub, IconLayers, IconSupport, IconTerminal, IconSettings } from '@portico/ui/icons';

/**
 * Hub shell — the suite variant from DESIGN-GUIDE §2a.
 *
 * Rail 56 (suite switcher: Hub + 3 apps + settings) and sidebar 236 (wordmark +
 * Pengguna + Peran). NO 200px nav tab: the Hub has no second level of
 * navigation, so rendering one would be inventing a nav layer the spec
 * explicitly deleted.
 */

const NAV = [
  { href: '/pengguna', label: 'Pengguna' },
  { href: '/peran', label: 'Peran' },
];

export function HubShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AppShell
      variant="hub"
      rail={
        <>
          <RailItem label="Portico Hub" active href="/pengguna">
            <IconHub />
          </RailItem>
          <RailItem label="Platform" href="/pilih-app?redirect=platform">
            <IconLayers />
          </RailItem>
          <RailItem label="Helpdesk" href="/pilih-app?redirect=helpdesk">
            <IconSupport />
          </RailItem>
          <RailItem label="Code Review" href="/pilih-app?redirect=codereview">
            <IconTerminal />
          </RailItem>
          <div className="mt-1 mb-1 w-6 h-px bg-[var(--border-standard)]" />
          <RailItem label="Pengaturan" href="/status-sistem">
            <IconSettings />
          </RailItem>
        </>
      }
      sidebar={
        <>
          <div className="h-9 flex items-center px-2 mb-3">
            <span className="font-semibold text-[15px] tracking-tight text-[var(--text-primary)]">
              Portico
            </span>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((it) => {
              const active = pathname === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`h-8 px-2.5 rounded-md flex items-center text-[14px] transition-colors ${
                    active
                      ? 'bg-[var(--surface-accent-tint)] text-[var(--accent-hover)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </>
      }
      topbar={<span className="heading-title">{title}</span>}
    >
      <ContentPane>{children}</ContentPane>
    </AppShell>
  );
}
