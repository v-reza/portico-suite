'use client';

/**
 * CreateAppModal — "Aplikasi baru", the manual (blank) path of US-A05.
 *
 * The design export only ever draws the AI variant of this dialog
 * (`platform_apps_list_modal_buat_aplikasi_ai/code.html`). US-A06 AC2 promises
 * two actions, "buat dari prompt" and "buat kosong", and this is the second
 * one; US-A05 AC1/AC2 are about it (name -> draft -> editor, empty name
 * refused in the field).
 *
 * Every value below is lifted from that reference rather than invented:
 *   560px panel, 24px padding, 16px gaps, 18px/600 title, 12px tertiary
 *   description, textarea `#f7f7f8` + hairline + 6px radius, chips `#ededf0`
 *   / 11px mono, footer split with a 16px top rule and `Batal` (white, hairline)
 *   next to the accent action button. The Modal primitive supplies the shared
 *   backdrop, radius, elevation and focus contract.
 */
import { useRef, useState } from 'react';
import { Modal } from '@portico/ui/modal';

export function CreateAppModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** The created draft, so the caller can open the editor on it (AC1). */
  onCreated: (app: { id: string; name: string; slug: string }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function reset() {
    setName('');
    setDescription('');
    setFieldError(null);
    setFormError(null);
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setFormError(null);
    // AC2 — the empty case never reaches the server, so the message sits on the
    // field the moment the user submits an empty form.
    if (!name.trim()) {
      setFieldError('Nama aplikasi wajib diisi.');
      nameRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 400 && data?.error === 'name_required') setFieldError(data.message);
        else setFormError(data?.message ?? 'Gagal membuat aplikasi.');
        return;
      }
      const created = data.app;
      reset();
      onCreated(created);
    } catch {
      setFormError('Terjadi kesalahan jaringan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Buat aplikasi baru"
      description="Mulai dari kosong. Halaman dan komponennya bisa diatur di builder."
      descriptionClassName="text-[12px] leading-relaxed text-[var(--text-tertiary)] mt-1"
      // Reference footer: a hairline rule, then `Batal` hard left and the accent
      // action hard right. `--border-subtle` is the divider token closest to the
      // reference's rgba(15,23,42,0.08) rule.
      footerClassName="flex items-center justify-between gap-2 mt-2 pt-4 border-t border-[var(--border-subtle)]"
      onClose={() => {
        reset();
        onClose();
      }}
      panelWidthClass="max-w-[560px]"
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
            form="create-app-form"
            disabled={busy}
            className="h-8 px-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white rounded-[6px] text-[13px] font-medium transition-colors"
          >
            {busy ? 'Menyimpan…' : 'Buat aplikasi'}
          </button>
        </>
      }
    >
      <form id="create-app-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {formError && (
          <div role="alert" className="p-3 rounded-md bg-[var(--critical-tint)] text-[var(--critical)] text-sm">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="app-name" className="block text-[0.75rem] font-medium text-[var(--text-tertiary)] mb-1.5">
            Nama aplikasi
          </label>
          <input
            ref={nameRef}
            id="app-name"
            name="name"
            type="text"
            autoComplete="off"
            placeholder="misal: Intake Vendor"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'app-name-error' : undefined}
            className={`w-full h-10 px-3 bg-[var(--surface-panel)] text-[var(--text-primary)] placeholder-[var(--text-quaternary)] text-[0.875rem] rounded-[6px] border focus:outline-none transition-colors ${
              fieldError
                ? 'border-[var(--critical)]'
                : 'border-[var(--border-standard)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]'
            }`}
          />
          {fieldError && (
            <p id="app-name-error" role="alert" className="mt-1.5 text-[0.75rem] text-[var(--critical)]">
              {fieldError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="app-description" className="block text-[0.75rem] font-medium text-[var(--text-tertiary)] mb-1.5">
            Deskripsi <span className="text-[var(--text-quaternary)] font-normal">(opsional)</span>
          </label>
          <textarea
            id="app-description"
            name="description"
            rows={3}
            placeholder="Aplikasi ini dipakai untuk apa?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full box-border bg-[#f7f7f8] border border-[var(--border-standard)] rounded-[6px] p-3 text-[14px] leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-quaternary)] resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </form>
    </Modal>
  );
}
