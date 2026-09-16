/**
 * ComponentPreview — the visual renderer for one builder component.
 *
 * Extracted from AppView so the builder canvas and the public form (US-A08
 * AC1/AC2/AC3) draw a component the same way. Two copies of this switch would
 * drift, and the drift would be invisible until a visitor saw a form that
 * differs from the builder's preview of it.
 *
 * `mode='preview'` is byte-for-byte the markup the builder already shipped (the
 * reference `platform_app_builder` treatment: 38px controls, 0.75rem labels,
 * `--text-quaternary` placeholders, `rounded`). `mode='form'` is the same
 * geometry with a real control in place of the picture of one — the visitor
 * types into the thing the builder drew, not into a lookalike.
 */
export interface PreviewComponent {
  id: string;
  type: string;
  config_json: Record<string, unknown> | null;
}

export function typeLabel(type: string): string {
  switch (type) {
    case 'heading': return 'Judul';
    case 'button': return 'Tombol';
    case 'divider': return 'Pemisah';
    case 'text': return 'Input teks';
    case 'select': return 'Dropdown';
    case 'date': return 'Tanggal';
    case 'rich_text': return 'Kartu';
    case 'table': return 'Tabel';
    case 'textarea': return 'Area teks';
    case 'image': return 'Gambar';
    case 'email': return 'Email';
    case 'number': return 'Angka';
    case 'checkbox': return 'Centang';
    case 'rating': return 'Rating';
    case 'file': return 'Upload';
    default: return type;
  }
}

/** Component types that collect a value from the visitor. */
export const INPUT_TYPES = ['text', 'email', 'number', 'textarea', 'date', 'select', 'checkbox'];

/** The 38px control box, shared by the picture and the real control. */
const FIELD = 'h-[38px] border border-[var(--border-standard)] rounded px-3 text-[0.875rem] bg-[var(--surface-panel)]';

/** The label tier the builder uses on every field. */
const FIELD_LABEL = 'block text-[0.75rem] text-[var(--text-tertiary)] mb-1.5 font-medium';

export function ComponentPreview({
  comp,
  mode = 'preview',
  name,
  error,
}: {
  comp: PreviewComponent;
  /** `preview` renders inert placeholders, `form` renders real controls. */
  mode?: 'preview' | 'form';
  /** Field id/name. Only meaningful in `form` mode. */
  name?: string;
  error?: string;
}) {
  const cfg = (comp.config_json ?? {}) as Record<string, any>;
  const label = cfg.label ?? cfg.text ?? typeLabel(comp.type);
  const isForm = mode === 'form';
  const fieldError = error && (
    <p role="alert" className="mt-1 text-[0.75rem] text-[var(--critical)]">{error}</p>
  );

  switch (comp.type) {
    case 'heading':
      return <h2 className="font-bold text-[1rem] text-[var(--text-primary)]">{cfg.text || label}</h2>;
    case 'button':
      // In form mode this is the submit control; the form wraps it.
      return (
        <button
          type={isForm ? 'submit' : 'button'}
          className="w-full bg-[var(--accent)] text-white font-medium text-[0.813rem] px-5 py-2.5 rounded text-center shadow-sm"
        >
          {label}
        </button>
      );
    case 'divider':
      return <div className="h-px bg-[var(--border-standard)]" />;
    case 'text':
    case 'email':
    case 'number':
    case 'textarea':
    case 'date':
      return (
        <div>
          <label htmlFor={name} className={FIELD_LABEL}>
            {label}{isForm && cfg.required && <span className="text-[var(--critical)]"> *</span>}
          </label>
          {isForm ? (
            <input
              id={name}
              name={name}
              type={comp.type === 'textarea' ? 'text' : comp.type}
              required={!!cfg.required}
              aria-invalid={!!error}
              placeholder={cfg.placeholder ?? ''}
              className={`w-full ${FIELD} text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]`}
            />
          ) : (
            <div className={`${FIELD} text-[var(--text-quaternary)] flex items-center`}>
              {cfg.placeholder ?? 'Isi di sini…'}
            </div>
          )}
          {fieldError}
        </div>
      );
    case 'select':
      return (
        <div>
          <label htmlFor={name} className={FIELD_LABEL}>
            {label}{isForm && cfg.required && <span className="text-[var(--critical)]"> *</span>}
          </label>
          {isForm ? (
            <select
              id={name}
              name={name}
              required={!!cfg.required}
              aria-invalid={!!error}
              className={`w-full ${FIELD} text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]`}
            >
              <option value="">Pilih opsi…</option>
              {(cfg.options ?? []).map((o: string) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <div className={`${FIELD} text-[var(--text-quaternary)] flex items-center justify-between`}>
              <span>Pilih opsi…</span>
              <span className="text-[var(--text-quaternary)]">▾</span>
            </div>
          )}
          {fieldError}
        </div>
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-[0.75rem] text-[var(--text-secondary)]">
          <input
            type="checkbox"
            name={name}
            value="true"
            disabled={!isForm}
            className="w-4 h-4 rounded border-[var(--border-standard)]"
          />
          {label}
        </label>
      );
    case 'rich_text':
      return (
        <div className="bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-lg p-4 shadow-sm">
          <h2 className="font-bold text-[1rem] text-[var(--text-primary)]">{cfg.heading || 'Judul Kartu'}</h2>
          <p className="text-[0.813rem] text-[var(--text-secondary)] mt-1">{cfg.body ?? 'Deskripsi singkat kartu ini.'}</p>
        </div>
      );
    case 'table':
      return (
        <div>
          <label className={FIELD_LABEL}>{label}</label>
          <div className="border border-[var(--border-standard)] rounded overflow-hidden">
            <div className="flex py-2 px-3 bg-[var(--surface-sunken)] text-[0.75rem] font-medium text-[var(--text-tertiary)]">
              <span className="flex-1">Kolom 1</span><span className="flex-1">Kolom 2</span>
            </div>
            <div className="flex py-2 px-3 text-[0.75rem] text-[var(--text-secondary)]">
              <span className="flex-1">–</span><span className="flex-1">–</span>
            </div>
          </div>
        </div>
      );
    default:
      return <span className="text-[0.75rem] text-[var(--text-secondary)]">{label}</span>;
  }
}
