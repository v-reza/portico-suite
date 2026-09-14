'use client';

/**
 * PlatformShell — the app-shell chrome for the Platform list/console pages,
 * cloned detail-for-detail from the Stitch reference `platform_apps_list_2`.
 *
 *   rail 56px   : brand hub mark · divider · Platform(active) · Helpdesk ·
 *                 Code Review · divider · Settings(bottom)
 *   sidebar 236: wordmark "Platform" (h-12, border-b) · grouped nav with
 *                 mono counters (Apps 6 / Komponen 18 / Integrasi 9 /
 *                 Alur Kerja 24 / Eksekusi 142 / Model & LLM 4 / Kunci API)
 *                 · user card (avatar initials + name + role)
 *
 * The app BUILDER (/apps/[id]) does NOT use this shell — it is a full-screen
 * toolbar + 3-panel workspace (see AppView). Keep list/console pages here.
 */
import type { ReactNode } from 'react';
import {
  IconHub, IconLayers, IconSupport, IconTerminal, IconSettings,
  IconGrid, IconExtension, IconCable, IconWorkflow, IconPlay, IconTune, IconKey,
} from '@portico/ui/icons';

interface NavItem { id: string; label: string; count?: string; href?: string; icon: (p: any) => ReactNode }
const ICON_SIZE = 17;

const GROUPED_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Apps',
    items: [
      { id: 'apps', label: 'Apps', count: '6', href: '/apps', icon: IconGrid },
      { id: 'components', label: 'Komponen', count: '18', icon: IconExtension },
      { id: 'integrations', label: 'Integrasi', count: '9', icon: IconCable },
    ],
  },
  {
    group: 'Workflow',
    items: [
      { id: 'workflows', label: 'Alur Kerja', count: '24', icon: IconWorkflow },
      { id: 'runs', label: 'Eksekusi', count: '142', icon: IconPlay },
      { id: 'llm', label: 'Model & LLM', count: '4', icon: IconTune },
      { id: 'keys', label: 'Kunci API', icon: IconKey },
    ],
  },
];

interface PlatformShellProps {
  /** Active sidebar nav id. */
  active?: string;
  user: { name: string; role: string };
  /** Top-bar right slot (search / actions). */
  toolbar?: ReactNode;
  /** Optional title shown in the top bar (default "Apps"). */
  title?: string;
  children: ReactNode;
}

export function PlatformShell({ active = 'apps', user, toolbar, title = 'Apps', children }: PlatformShellProps) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--surface-page)] text-[var(--text-primary)] font-body flex">
      {/* RAIL 56px */}
      <aside className="w-[56px] min-w-[56px] h-full bg-[var(--surface-panel)] border-r border-[var(--border-standard)] flex flex-col items-center justify-between py-3 z-20">
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-accent-tint)] flex items-center justify-center text-[var(--accent)]">
            <IconHub size={20} />
          </div>
          <div className="w-8 h-[1px] bg-[var(--border-standard)] my-1" />
          <button title="Platform (Aktif)" className="w-9 h-9 rounded-md bg-[var(--surface-accent-tint)] text-[var(--accent-hover)] flex items-center justify-center transition-colors">
            <IconLayers size={ICON_SIZE} />
          </button>
          <button title="Helpdesk" className="w-9 h-9 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
            <IconSupport size={ICON_SIZE} />
          </button>
          <button title="Code Review" className="w-9 h-9 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
            <IconTerminal size={ICON_SIZE} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="w-8 h-[1px] bg-[var(--border-standard)] my-1" />
          <button title="Pengaturan Sistem" className="w-9 h-9 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
            <IconSettings size={ICON_SIZE} />
          </button>
        </div>
      </aside>

      {/* SIDEBAR 236px */}
      <aside className="w-[236px] min-w-[236px] h-full bg-[var(--surface-panel)] border-r border-[var(--border-standard)] flex flex-col justify-between z-10">
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="h-12 flex items-center px-4 border-b border-[var(--border-standard)]">
            <span className="text-[1rem] tracking-tight text-[var(--text-primary)]" style={{ fontWeight: 560 }}>Platform</span>
          </div>
          <div className="p-3 space-y-5">
            {GROUPED_NAV.map((g) => (
              <div key={g.group}>
                <div className="px-2 mb-1.5 font-mono text-[11px] font-medium uppercase text-[var(--text-quaternary)] tracking-wider">
                  {g.group}
                </div>
                <nav className="space-y-0.5">
                  {g.items.map((item) => {
                    const Icon = item.icon;
                    const on = active === item.id;
                    return (
                      <a
                        key={item.id}
                        href={item.href ?? '#'}
                        aria-current={on ? 'page' : undefined}
                        className={[
                          'flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors',
                          on
                            ? 'bg-[var(--surface-accent-tint)] text-[var(--accent-hover)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
                        ].join(' ')}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={16} />
                          <span className={on ? 'font-medium' : ''}>{item.label}</span>
                        </div>
                        {item.count && (
                          <span className={[
                            'font-mono text-[11px] px-1.5 py-0.5 rounded-full font-medium',
                            on ? 'bg-[var(--surface-panel)] text-[var(--accent-hover)]' : 'bg-[var(--surface-sunken)] text-[var(--text-tertiary)]',
                          ].join(' ')}>
                            {item.count}
                          </span>
                        )}
                      </a>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* User card */}
        <div className="p-3 border-t border-[var(--border-standard)]">
          <div className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">
            <div className="w-[26px] h-[26px] min-w-[26px] rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)] flex items-center justify-center text-[11px] font-mono font-medium">
              {initials(user.name)}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-medium text-[var(--text-primary)] truncate leading-snug">{user.name}</span>
              <span className="text-[11px] text-[var(--text-quaternary)] truncate leading-none">{roleLabel(user.role)}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN PANE + TOP BAR */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[var(--surface-page)] overflow-hidden">
        <header className="h-12 min-h-[48px] bg-[var(--surface-panel)] border-b border-[var(--border-standard)] px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[1rem] tracking-tight text-[var(--text-primary)]" style={{ fontWeight: 560 }}>{title}</h1>
          </div>
          {toolbar}
        </header>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'U';
}

function roleLabel(role: string) {
  switch (role) {
    case 'admin': return 'Platform Admin';
    case 'builder': return 'Builder';
    default: return 'Viewer';
  }
}