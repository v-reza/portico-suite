import { randomBytes } from 'node:crypto';

/**
 * Slugs — workspace slugs (US-A01 AC3) and app slugs (US-A05 AC3).
 *
 * Both are derived from a human name and must stay unique inside their scope:
 * a workspace slug is globally UNIQUE, an app slug is UNIQUE per `org_id`. The
 * lookup below is only an optimisation — the UNIQUE constraint is the authority
 * when two writers race, and the caller retries on the violation.
 */

const MAX_BASE = 48;

/** Any statement runner: the pool, or a client inside a transaction. */
export type Runner = (text: string, params?: unknown[]) => Promise<{ rows: { slug: string }[] }>;

/**
 * The tables this helper is allowed to touch, and how their uniqueness is
 * scoped. A closed union (rather than a table name argument) keeps the
 * interpolated identifier out of the caller's hands.
 */
export interface SlugScope {
  table: 'organizations' | 'apps';
  /** Parent column the uniqueness is scoped to. `apps` is unique per org. */
  scopeColumn?: 'org_id';
  scopeValue?: string;
}

/** "  Tim  Marketing ANDALAN!! " -> "tim-marketing-andalan" */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE)
    .replace(/-+$/g, '');
}

/**
 * The smallest free slug for `name` inside `scope`: the plain slug when free,
 * else -2, -3, ... (US-A05 AC3 — a duplicate name gets a unique slug, not an
 * error.)
 *
 * The lookup is a prefix match so two different names that slugify to the same
 * base can never collide. A concurrent writer can still slip in between the
 * lookup and the INSERT; the caller retries on the UNIQUE violation.
 */
export async function uniqueSlugIn(
  run: Runner,
  name: string,
  scope: SlugScope,
  fallback: string,
): Promise<string> {
  const base = slugify(name) || fallback;
  const scoped = scope.scopeColumn !== undefined;
  const { rows } = await run(
    `SELECT slug FROM ${scope.table} WHERE ${scoped ? `${scope.scopeColumn} = $2 AND ` : ''}` +
      `(slug = $1 OR slug ~ ('^' || $1 || '-[0-9]+$'))`,
    scoped ? [base, scope.scopeValue] : [base],
  );
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Workspace slug: unique across every workspace (US-A01 AC3). */
export function uniqueSlug(run: Runner, name: string): Promise<string> {
  return uniqueSlugIn(run, name, { table: 'organizations' }, 'workspace');
}

/**
 * A slug that does not depend on winning a race: `base` plus 4 random bytes.
 *
 * The scoped lookup above is a read followed by an INSERT, so N writers that
 * share one name can all read the same free slug and then fight over it.
 * Retrying the lookup is not enough — the losers re-read the same answer and
 * give up, which surfaced as a 500. This is the retry that always terminates: a
 * 1-in-4-billion collision is worth a second attempt, not another round of
 * contention.
 */
export function randomSlug(name: string, fallback = 'workspace'): string {
  const base = slugify(name) || fallback;
  return `${base}-${randomBytes(4).toString('hex')}`;
}
