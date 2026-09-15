'use client';

/**
 * PromptAppModal — "buat dari prompt", the first of the two actions US-A06 AC2
 * promises on the empty state.
 *
 * The dialog is a clone of the export's AI variant
 * (`platform_apps_list_modal_buat_aplikasi_ai/code.html`), which is the only
 * dialog the design ever draws for this screen:
 *
 *   560px panel · 24px padding · 16px gaps · 18px/600 title · 12px tertiary
 *   subtitle · textarea `#f7f7f8` + hairline + 6px radius + 12px padding +
 *   14px/1.5 text, `resize:none` · suggestion chips `#ededf0` on `#4b5058`,
 *   11px mono, full radius, 4px/10px padding, `rgba(15,23,42,0.06)` hairline ·
 *   split footer with a 16px top rule, `Batal` (panel/hairline) beside
 *   `Generate` (accent).
 *
 * The Modal primitive supplies the shared backdrop, 12px radius, dialog
 * elevation and the focus/Escape/backdrop contract, so none of that is
 * re-implemented here.
 *
 * Two composition calls the design left open:
 *   - The reference's textarea carries sample *content* ("Aplikasi intake
 *     vendor: form pendaftaran…"). Opening a real dialog pre-filled with
 *     somebody else's description would be wrong product behaviour, so that
 *     copy is kept verbatim as the placeholder instead.
 *   - The chips fill the field when clicked. The reference draws them with
 *     `cursor: pointer`, so they are controls, not decoration.
 */
import { useRef, useState } from 'react';
import { Modal } from '@portico/ui/modal';

/** Verbatim from the reference, in reference order. */
const SUGGESTIONS = ['Form intake', 'Dashboard penjualan', 'Approval cuti'];

const PLACEHOLDER =
  'Aplikasi intake vendor: form pendaftaran dengan upload dokumen, tabel daftar rekanan, dan validasi otomatis.';

export function PromptAppModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** The generated draft, so the caller can open its editor. */
  onCreated: (app: { id: string; name: string; slug: string }) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  function reset() {
    setPrompt('');
    setError(null);
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (prompt.trim().length < 5) {
      setError('Jelaskan aplikasinya minimal 5 karakter.');
      promptRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/ai/generate-app', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        // The generator's own message (validation, a taken slug) is what the
        // user needs to see; inventing a friendlier one would hide the cause.
        setError(data?.message ?? 'Gagal membuat aplikasi dari prompt.');
        return;
      }
      const created = data.app;
      reset();
      onCreated(created);
    } catch {
      setError('Terjadi kesalahan jaringan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Buat aplikasi dari prompt"
      description="Jelaskan aplikasi yang kamu butuhkan. AI menyusun halaman dan komponennya."
      onClose={() => {
        reset();
        onClose();
      }}
      panelWidthClass="max-w-[560px]"
      descriptionClassName="text-[12px] text-[var(--text-tertiary)] mt-1"
      footerClassName="flex items-center justify-between gap-2 mt-2 pt-4 border-t border-[var(--border-standard)]"
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="h-8 px-4 bg-[var(--surface-panel)] border border-[var(--border-standard)] text-[var(--text-secondary)] rounded-[6px] text-[13px] font-medium hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="prompt-app-form"
            disabled={busy}
            className="h-8 px-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white rounded-[6px] text-[13px] font-medium transition-colors"
          >
            {busy ? 'Menyusun…' : 'Generate'}
          </button>
        </>
      }
    >
      <form id="prompt-app-form" onSubmit={submit} className="flex flex-col gap-3" noValidate>
        {error && (
          <div role="alert" className="p-3 rounded-md bg-[var(--critical-tint)] text-[var(--critical)] text-sm">
            {error}
          </div>
        )}

        <textarea
          ref={promptRef}
          id="app-prompt"
          name="prompt"
          rows={5}
          maxLength={500}
          placeholder={PLACEHOLDER}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (error) setError(null);
          }}
          className="w-full box-border bg-[#f7f7f8] border border-[var(--border-standard)] rounded-[6px] p-3 text-[14px] leading-normal text-[var(--text-primary)] placeholder-[var(--text-quaternary)] resize-none outline-none focus:border-[var(--accent)] transition-colors"
        />

        <div className="flex flex-wrap gap-2 items-center">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setPrompt(s);
                if (error) setError(null);
                promptRef.current?.focus();
              }}
              className="font-mono text-[11px] bg-[var(--surface-sunken)] text-[var(--text-secondary)] rounded-full px-2.5 py-1 border border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </form>
    </Modal>
  );
}
