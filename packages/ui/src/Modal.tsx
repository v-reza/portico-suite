'use client';

/**
 * Modal — the suite's own dialog. Browser `alert`/`confirm`/`prompt` are banned
 * in this codebase (they cannot be styled, cannot be trapped, and block the
 * event loop), so every confirmation and every input prompt goes through here.
 *
 * Behaviour contract:
 *   - role="dialog" + aria-modal, labelled by the title
 *   - focus moves into the panel on open, returns to the trigger on close
 *   - Escape closes, backdrop click closes
 *   - Tab is trapped inside the panel
 *   - background scroll is locked while open
 *   - animation is skipped under `prefers-reduced-motion` (Tailwind motion-safe)
 *
 * Styling follows the Stitch builder reference: `--surface-panel` panel,
 * hairline `--border-standard`, 12px radius (modal-only radius per the design
 * spec), backdrop rgba(15,23,42,0.45).
 */
import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first control; falling back to the panel keeps the dialog
    // itself reachable for screen readers when it has no focusable child yet.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-[440px] bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[12px] shadow-xl p-6 focus:outline-none motion-safe:animate-[po-modal-in_120ms_ease-out]"
      >
        <h3 className="text-[1rem] font-semibold text-[var(--text-primary)]">{title}</h3>
        {description && (
          <p className="text-[0.813rem] text-[var(--text-secondary)] mt-2">{description}</p>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="flex justify-end gap-2 mt-6">{footer}</div>
      </div>
    </div>
  );
}
