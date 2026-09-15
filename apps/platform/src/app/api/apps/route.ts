import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { pool, query } from '@/lib/db';
import { getSessionUser, jsonError, can } from '@/lib/auth';
import { randomSlug, uniqueSlugIn } from '@/lib/slug';

/**
 * App slugs are unique per workspace, not globally: two teams may both have a
 * "CRM" (US-A05 AC3 is scoped to "di workspace itu").
 */
const APP_SLUG_SCOPE = { table: 'apps', scopeColumn: 'org_id' } as const;

/** 23505 = unique_violation. `constraint` names which one lost the race. */
function uniqueViolation(e: unknown): string | null {
  const err = e as { code?: string; constraint?: string };
  return err?.code === '23505' ? (err.constraint ?? '') : null;
}

/** How many times the deterministic slug may lose before we stop contending. */
const MAX_SLUG_ATTEMPTS = 5;

/**
 * GET /api/apps — the workspace's app list.
 *
 * US-A07 AC2 — an archived app is gone from the **main** list. The archive
 * filter is a server-side WHERE, not a client-side hide, so a caller who
 * bypasses the UI still cannot see it in the default view.
 *
 * `?status=archived` is the one view that does return them: that is where the
 * restore entry point lives (US-A07 AC3).
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');

  const status = new URL(req.url).searchParams.get('status');
  const where =
    status === 'archived' ? 'archived_at IS NOT NULL'
    : status === 'published' ? 'archived_at IS NULL AND is_published'
    : status === 'draft' ? 'archived_at IS NULL AND NOT is_published'
    : 'archived_at IS NULL';

  const apps = await query(
    `SELECT id, name, slug, description, version, is_published, archived_at, created_at, updated_at
       FROM apps WHERE org_id = $1 AND ${where}
      ORDER BY created_at DESC`,
    [user.org_id],
  );
  return NextResponse.json({ apps: apps.rows });
}

/**
 * POST /api/apps — create a new app (US-A05).
 *
 * AC1: the row is written with `is_published = false` (a draft) and the response
 *      carries the id the editor is opened with.
 * AC2: an empty name is refused with a field-level error; the client shows the
 *      message on the name input.
 * AC3: the slug comes from the name and is made unique inside the workspace —
 *      a second "CRM" becomes `crm-2`, never a 409.
 * AC4: the creation is written to `activity_logs` with the actor and the time.
 *
 * AC1 + AC4 are one transaction: an app that exists without its audit entry is
 * exactly the state the AC forbids.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return jsonError(401, 'unauthenticated', 'Silakan masuk terlebih dahulu.');
  if (!can(user, ['admin', 'builder'])) {
    return jsonError(403, 'forbidden', 'Anda tidak punya izin membuat app.');
  }

  const { name, description } = await req.json().catch(() => ({}));
  // AC2 — the field is named in the payload so the form can mark the input
  // itself rather than showing a page-level banner.
  if (typeof name !== 'string' || !name.trim()) {
    return jsonError(400, 'name_required', 'Nama aplikasi wajib diisi.');
  }
  const appName = name.trim();

  const client = await pool.connect();
  try {
    // AC3 under concurrency: a deterministic slug is only unique once the INSERT
    // has committed, so the loop re-reads after a loss. Past MAX_SLUG_ATTEMPTS
    // the next value cannot contend at all (randomSlug), which is what stops
    // this from turning a burst of identical names into 500s.
    let fallback = false;
    for (let attempt = 1; ; attempt++) {
      const appId = randomBytes(8).toString('hex');
      const slug = fallback
        ? randomSlug(appName, 'app')
        : await uniqueSlugIn(
            (text, params) => client.query(text, params as never),
            appName,
            { ...APP_SLUG_SCOPE, scopeValue: user.org_id },
            'app',
          );

      await client.query('BEGIN');
      try {
        const created = await client.query(
          `INSERT INTO apps (id, org_id, name, slug, description, is_published)
           VALUES ($1, $2, $3, $4, $5, false)
           RETURNING id, name, slug, description, version, is_published, created_at, updated_at`,
          [appId, user.org_id, appName, slug, description?.trim() || null],
        );
        await client.query(
          `INSERT INTO activity_logs (id, org_id, user_id, action, entity_type, entity_id, meta_json)
           VALUES ($1, $2, $3, 'app_created', 'app', $4, $5)`,
          [randomBytes(8).toString('hex'), user.org_id, user.id, appId, JSON.stringify({ name: appName, slug })],
        );
        await client.query('COMMIT');
        return NextResponse.json({ app: created.rows[0] }, { status: 201 });
      } catch (e) {
        await client.query('ROLLBACK');
        const constraint = uniqueViolation(e);
        if (!constraint) throw e;
        // `apps_org_id_slug_key` — someone else took the slug. Retry, and stop
        // contending once the deterministic attempts are exhausted.
        fallback = attempt >= MAX_SLUG_ATTEMPTS;
      }
    }
  } finally {
    client.release();
  }
}
