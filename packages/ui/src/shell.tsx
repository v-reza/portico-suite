/**
 * AppShell — the shell every app page uses. DESIGN-GUIDE §2 pins the numbers:
 *
 *   rail 56px  |  sidebar 236px  |  top bar 48px
 *
 * The Hub is the ONE exception (§2a SHELL HUB): its rail is a suite switcher and
 * its sidebar holds only "Pengguna" + "Peran". It has NO 200px nav tab — pass
 * `variant="hub"` and do not render <NavTabs>.
 *
 *   <AppShell rail={...} sidebar={...} topbar={...}>
 *     <NavTabs items={...} />   // app variant only
 *     {children}
 *   </AppShell>
 *
 * ponytail: plain flex + inline width vars, no layout library. The shell is four
 * boxes; a dependency here would be the tail wagging the dog.
 */

import type { CSSProperties, ReactNode } from 'react';

const RAIL_W = 56;
const SIDEBAR_W = 236;
const TOPBAR_H = 48;
const LIST_PANE_W = 340;

export type ShellVariant = 'app' | 'hub';

export interface AppShellProps {
  variant?: ShellVariant;
  rail: ReactNode;
  sidebar: ReactNode;
  topbar: ReactNode;
  /** Right-hand list pane (ticket list, PR list). Omit for full-width pages. */
  listPane?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  variant = 'app',
  rail, sidebar, topbar, listPane, children,
}: AppShellProps) {
  return (
    <div
      data-shell={variant}
      style={{
        display: 'flex',
        minHeight: '100dvh',
        background: 'var(--surface-page)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--text-body-family, Inter)',
        fontSize: 'var(--text-body-size, 0.875rem)',
      }}
    >
      <Rail>{rail}</Rail>
      <Sidebar variant={variant}>{sidebar}</Sidebar>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar>{topbar}</TopBar>
        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            gap: 0,
            overflow: 'hidden',
          }}
        >
          {listPane ? (
            <div
              style={{
                width: LIST_PANE_W,
                flexShrink: 0,
                borderRight: '1px solid var(--border-standard)',
                overflowY: 'auto',
                background: 'var(--surface-panel)',
              }}
            >
              {listPane}
            </div>
          ) : null}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}

function Rail({ children }: { children: ReactNode }) {
  return (
    <nav
      aria-label="Suite switcher"
      style={{
        width: RAIL_W,
        flexShrink: 0,
        background: 'var(--surface-panel)',
        borderRight: '1px solid var(--border-standard)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '8px 0',
      }}
    >
      {children}
    </nav>
  );
}

export function RailItem({
  label, active, children, href,
}: { label: string; active?: boolean; children: ReactNode; href?: string }) {
  const Tag: any = href ? 'a' : 'button';
  return (
    <Tag
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      style={{
        width: 32,
        height: 32,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--surface-accent-tint)' : 'transparent',
        color: active ? 'var(--accent-hover)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </Tag>
  );
}

function Sidebar({ variant, children }: { variant: ShellVariant; children: ReactNode }) {
  return (
    <aside
      style={{
        width: SIDEBAR_W,
        flexShrink: 0,
        background: 'var(--surface-panel)',
        borderRight: '1px solid var(--border-standard)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        // The Hub sidebar is short by design (wordmark + 2 items); letting it
        // stretch keeps the panel edge aligned with the app variant.
        padding: variant === 'hub' ? '12px 10px' : '8px 10px',
      }}
    >
      {children}
    </aside>
  );
}

function TopBar({ children }: { children: ReactNode }) {
  return (
    <header
      style={{
        height: TOPBAR_H,
        flexShrink: 0,
        background: 'var(--surface-panel)',
        borderBottom: '1px solid var(--border-standard)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
      }}
    >
      {children}
    </header>
  );
}

/**
 * Nav tabs — the 200px tab strip that lives INSIDE the content pane of app
 * pages. Never render this in the Hub (see §2a).
 */
export function NavTabs({
  items, active,
}: { items: { id: string; label: string; href?: string }[]; active: string }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 4,
        padding: '8px 16px 0',
        borderBottom: '1px solid var(--border-standard)',
      }}
    >
      {items.map((it) => {
        const on = it.id === active;
        return (
          <a
            key={it.id}
            href={it.href}
            role="tab"
            aria-selected={on}
            style={{
              width: 200,
              padding: '7px 10px',
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              fontSize: '0.813rem',
              fontWeight: 560,
              textDecoration: 'none',
              background: on ? 'var(--surface-accent-tint)' : 'transparent',
              color: on ? 'var(--accent-hover)' : 'var(--text-tertiary)',
            }}
          >
            {it.label}
          </a>
        );
      })}
    </div>
  );
}

export function ContentPane({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ padding: 24, maxWidth: 1120, ...style }}>{children}</div>;
}
