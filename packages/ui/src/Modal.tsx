'use client';

/**
 * Modal — the suite's own dialog. Browser `alert`/`confirm`/`prompt` are banned
 * in this codebase (they cannot be styled, cannot be trapped, and block the
 * event loop), so every confirmation and every input prompt goes through here.
 *
 * Behaviour contract:
 *   - role="dialog" + aria-modal, labelled by the title
 *   - focus moves into the panel on open, returns to the trigger on close
 *   - Escape closes, backdrop click closes, the header close control closes
 *   - Tab is trapped inside the panel
 *   - background scroll is locked while open
 *   - animation is skipped under `prefers-reduced-motion` (Tailwind motion-safe)
 *
 * Styling follows the Stitch builder reference: `--surface-panel` panel,
 * hairline `--border-standard`, 12px radius (modal-only radius per the design
 * spec), `--overlay` token for the backdrop, elevation from the token file.
 *
 * Panel layout follows the reference: `flex flex-col gap-4` so all children
  * (title, description, form, footer) space evenly at 16px. The footer parameter
  * carries its own spacing and optional border.
 */
import { useEffect, useId, useRef } from 'react';
import { IconX } from './icons';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  panelWidthClass = 'max-w-[440px]',
  descriptionClassName = 'text-[0.813rem] text-[var(--text-secondary)]',
  footerClassName = 'flex justify-end gap-2',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  footer: React.ReactNode;
  /**
   * Panel width. The reference dialogs are not one size: the confirm-style
   * dialogs are 440px, the create-app form is 560px (both are literal widths in
   * the Stitch export), so the width is a parameter rather than a new panel.
   */
  panelWidthClass?: string;
  /**
   * Subtitle and footer treatments are parameters for the same reason as the
   * width: the reference dialogs are not identical. The create-app dialog has a
   * 12px `--text-tertiary` subtitle and a ruled footer split left/right; the
   * confirm-style dialogs keep these defaults. A caller that passes neither is
   * byte-for-byte unchanged.
   */
  descriptionClassName?: string;
  footerClassName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // aria-labelledby needs a real id on the heading; useId keeps it unique when
  // two dialogs exist in one tree.
  const titleId = useId();
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first control; falling back to the panel keeps the dialog
    // itself reachable for screen readers when it has no focusable child yet.
    // The header close control is skipped so an input dialog opens with the
    // caret already in its first field rather than on "dismiss".
    const candidates = Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = candidates.find((el) => !el.hasAttribute('data-dialog-dismiss'));
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
      style={{ background: 'var(--overlay)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${panelWidthClass} flex flex-col gap-4 bg-[var(--surface-panel)] border border-[var(--border-standard)] rounded-[12px] p-6 focus:outline-none motion-safe:animate-[po-modal-in_120ms_ease-out]`}
        // The reference panel is `border: 1px solid rgba(15,23,42,0.10)` PLUS a
        // two-layer shadow. The `--elevation-dialog` token folds a third layer
        // (`0 0 0 1px` same colour) into the shadow, so using the token verbatim
        // alongside the border draws the hairline twice and the edge reads
        // heavier than the reference. Keep the border (it is what makes the
        // panel 560px border-box, matching the reference's inner width) and use
        // only the token's two elevation layers here.
        style={{ boxShadow: '0 16px 48px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.08)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 id={titleId} className="text-[1.125rem] font-semibold leading-[1.33] text-[var(--text-primary)]">{title}</h3>
          </div>
          {/* Reference treatment (platform_apps_list_modal_buat_aplikasi_ai):
              transparent control, 4px padding, --text-tertiary/close glyph. */}
          <button
            type="button"
            data-dialog-dismiss
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 p-[4px] rounded text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>
        {description && (
          <p className={descriptionClassName}>{description}</p>
        )}
        {children && <div>{children}</div>}
        <div className={footerClassName}>{footer}</div>
      </div>
    </div>
  );
}