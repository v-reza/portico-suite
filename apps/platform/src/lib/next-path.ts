/**
 * `?next=` handling for US-A02 AC4 ("diarahkan login dan kembali ke halaman
 * tujuan setelah masuk").
 *
 * The value round-trips through a query string, so it is attacker-controlled:
 * `?next=https://evil.example` would turn our login page into an open redirect.
 * Only a same-site absolute path is accepted — a leading `/` and no `//` or
 * backslash (which some browsers normalise to a host). Everything else falls
 * back to the apps list.
 */
const DEFAULT_NEXT = '/apps';

export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string' || !value) return DEFAULT_NEXT;
  // Must be absolute-path only: reject protocol-relative ("//host"), schemes
  // ("https:"), and backslash variants browsers may treat as a separator.
  if (!value.startsWith('/')) return DEFAULT_NEXT;
  if (value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_NEXT;
  if (value.includes('\\')) return DEFAULT_NEXT;
  return value;
}

export { DEFAULT_NEXT };
