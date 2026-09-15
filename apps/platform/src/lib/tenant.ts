import { NextResponse } from 'next/server';
import { one } from './db';
import { jsonError, type PlatformUser } from './auth';

/**
 * US-A04 AC6 — an app belongs to exactly one workspace, and so does everything
 * hanging off it (pages, components, workflows, steps, data rows). A caller
 * from workspace Y that guesses a URL belonging to workspace X must be refused
 * **on the server** and learn nothing about the row.
 *
 * Two distinct answers, deliberately:
 *   - the id does not exist at all        -> 404
 *   - the id exists in another workspace  -> 403
 * The lookup therefore does NOT filter by `org_id`. Filtering would collapse
 * the cross-workspace case into a 404, which is the opposite of what the AC
 * asks for — and it would make a cross-tenant probe indistinguishable from a
 * typo, so nobody could ever alert on it.
 *
 * The refused response carries only a generic message: no name, no slug, no
 * counts. That is the "tidak ada data yang terungkap" half of the AC.
 */
export type TenantCheck =
  | { ok: true; row: Record<string, any> }
  | { ok: false; response: NextResponse };

const MESSAGES = {
  app: 'App tidak ditemukan.',
  page: 'Halaman tidak ditemukan.',
  component: 'Komponen tidak ditemukan.',
  workflow: 'Workflow tidak ditemukan.',
  step: 'Langkah tidak ditemukan.',
} as const;

async function guard(
  sql: string,
  params: string[],
  label: keyof typeof MESSAGES,
  user: PlatformUser,
): Promise<TenantCheck> {
  const row = await one(sql, params);
  if (!row) {
    return { ok: false, response: jsonError(404, 'not_found', MESSAGES[label]) };
  }
  if (row.org_id !== user.org_id) {
    return { ok: false, response: jsonError(403, 'forbidden', 'Akses ditolak.') };
  }
  return { ok: true, row };
}

export function appInOrg(appId: string, user: PlatformUser): Promise<TenantCheck> {
  // `name`/`slug` are carried because the delete path logs what it destroyed
  // (US-A07 AC5) — reading them afterwards is impossible, the row is gone.
  return guard(
    'SELECT id, org_id, name, slug, is_published, archived_at FROM apps WHERE id = $1',
    [appId],
    'app',
    user,
  );
}

export function pageInOrg(pageId: string, user: PlatformUser): Promise<TenantCheck> {
  return guard(
    `SELECT p.id, a.org_id FROM pages p JOIN apps a ON a.id = p.app_id WHERE p.id = $1`,
    [pageId],
    'page',
    user,
  );
}

export function componentInOrg(componentId: string, user: PlatformUser): Promise<TenantCheck> {
  return guard(
    `SELECT c.id, a.org_id FROM components c
       JOIN pages p ON p.id = c.page_id
       JOIN apps a ON a.id = p.app_id
      WHERE c.id = $1`,
    [componentId],
    'component',
    user,
  );
}

export function workflowInOrg(workflowId: string, user: PlatformUser): Promise<TenantCheck> {
  return guard(
    `SELECT w.id, w.active, a.org_id FROM workflows w
       JOIN apps a ON a.id = w.app_id
      WHERE w.id = $1`,
    [workflowId],
    'workflow',
    user,
  );
}

export function stepInOrg(stepId: string, user: PlatformUser): Promise<TenantCheck> {
  return guard(
    `SELECT s.id, a.org_id FROM workflow_steps s
       JOIN workflows w ON w.id = s.workflow_id
       JOIN apps a ON a.id = w.app_id
      WHERE s.id = $1`,
    [stepId],
    'step',
    user,
  );
}
