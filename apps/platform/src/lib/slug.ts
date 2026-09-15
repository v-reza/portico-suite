import { randomBytes } from 'node:crypto';

/**
 * Workspace slugs (US-A01 AC3).
 *
 * A workspace name is free text ("Tim  Marketing ANDALAN"); the slug is what the
 * app puts in URLs, so it is derived from the name and stays unique across every
 * workspace. `organizations.slug` is UNIQUE — that constraint, not this lookup,
 * is the authority when two registrations race.
 */

const MAX_BASE = 48;

/** Any statement runner: the pool, or a client inside a transaction. */
export type Runner = (text: string, params?: unknown[]) => Promise<{ rows: { slug: string }[] }>;

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
 * The smallest free slug for `name`: the plain slug when free, else -2, -3, ...
 *
 * The lookup is a prefix match so two different names that slugify to the same
 * base can never collide. A concurrent registration can still slip in between
 * the lookup and the INSERT; the caller retries on the UNIQUE violation.
 */
export async function uniqueSlug(run: Runner, name: string): Promise<string> {
  const base = slugify(name) || 'workspace';
  const { rows } = await run(
    `SELECT slug FROM organizations WHERE slug = $1 OR slug ~ ('^' || $1 || '-[0-9]+$')`,
    [base],
  );
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * A slug that does not depend on winning a race: `base` plus 4 random bytes.
 *
 * `uniqueSlug` is a lookup followed by an INSERT, so N registrations that share
 * one name can all read the same free slug and then fight over it. Retrying the
 * lookup is not enough — the losers re-read the same answer and give up, which
 * surfaced as a 500. This is the retry that always terminates: a 1-in-4-billion
 * collision is worth a second attempt, not another round of contention.
 */
export function randomSlug(name: string): string {
  const base = slugify(name) || 'workspace';
  return `${base}-${randomBytes(4).toString('hex')}`;
}
