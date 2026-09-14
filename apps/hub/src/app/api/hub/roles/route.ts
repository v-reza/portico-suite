import { NextResponse, type NextRequest } from 'next/server';
import { one, query } from '@/lib/db';
import { getSessionUser, jsonError, sameOrigin } from '@/lib/auth';
import { audit } from '@/lib/audit';

/**
 * /api/hub/roles — read the role model, and change a single assignment.
 *
 * GET  -> per-app vocabulary + read-only permission matrix (US-M11 AC4/AC5)
 * PUT  -> grant / change / revoke one (user, app) role (US-M11 AC2/AC3/AC7)
 *
 * Both live in one file on purpose: they are two halves of the same resource,
 * and splitting them across two route files silently loses one of them.
 */

// --- GET: vocabulary + matrix ----------------------------------------------

/**
 * Role vocabulary is declared per app and reported as-is (US-M11 AC4). Platform
 * says admin/builder/viewer, Helpdesk says admin/agent/customer, Code Review is
 * per-repo. Mapping these onto one shared enum would break every app that
 * already shipped with its own words (§5.1).
 */
const VOCABULARY: Record<string, string[]> = {
  platform: ['owner', 'admin', 'builder', 'viewer'],
  helpdesk: ['admin', 'supervisor', 'agent', 'customer'],
  'code-review': ['lead', 'reviewer', 'viewer'],
  portico_hub: ['admin'],
};

const MATRIX = {
  // AC5: the matrix is not editable. The UI must say so, and clicking a cell
  // must change nothing.
  readOnly: true,
  caption: 'Matriks ini baca-saja. Ubah peran lewat halaman Pengguna.',
  capabilities: [
    { key: 'view', label: 'Lihat' },
    { key: 'create', label: 'Buat' },
    { key: 'edit', label: 'Ubah' },
    { key: 'delete', label: 'Hapus' },
    { key: 'manage_members', label: 'Kelola anggota' },
  ],
  cells: {
    platform: {
      owner: ['view', 'create', 'edit', 'delete', 'manage_members'],
      admin: ['view', 'create', 'edit', 'delete', 'manage_members'],
      builder: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
    helpdesk: {
      admin: ['view', 'create', 'edit', 'delete', 'manage_members'],
      supervisor: ['view', 'create', 'edit', 'manage_members'],
      agent: ['view', 'create', 'edit'],
      customer: ['view', 'create'],
    },
    'code-review': {
      lead: ['view', 'create', 'edit', 'delete', 'manage_members'],
      reviewer: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
    portico_hub: { admin: ['view', 'create', 'edit', 'delete', 'manage_members'] },
  },
} as const;

export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return jsonError(401, 'unauthenticated', 'Login dulu.');

  const clients = await query<{ id: string; name: string }>(
    'SELECT id, name FROM hub_clients ORDER BY id',
  );
  const granted = await query<{ app_id: string; role: string; n: string }>(
    'SELECT app_id, role, count(*)::text AS n FROM hub_app_roles GROUP BY app_id, role ORDER BY app_id, role',
  );

  return NextResponse.json({
    apps: clients.map((c) => ({
      appId: c.id,
      appName: c.name,
      roles: VOCABULARY[c.id] ?? [],
      holders: granted
        .filter((g) => g.app_id === c.id)
        .map((g) => ({ role: g.role, count: Number(g.n) })),
    })),
    matrix: MATRIX,
  });
}

// --- PUT: change one assignment ---------------------------------------------

/**
 * Roles that count as "can administer the app". Losing the last holder of one of
 * these would make the app unadministrable — only a DB edit could fix it, so it
 * is refused with an explanation instead (US-M11 AC7).
 */
const ADMIN_ROLES = new Set(['owner', 'admin', 'lead', 'supervisor']);

export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'bad_origin', 'Origin tidak dikenal.');
  const me = await getSessionUser(req);
  if (!me) return jsonError(401, 'unauthenticated', 'Login dulu.');

  let body: { userId?: string; appId?: string; role?: string | null };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'bad_json', 'Body bukan JSON.');
  }

  const { userId, appId } = body;
  const role = body.role ?? null;
  if (!userId || !appId) return jsonError(400, 'missing_params', 'userId dan appId wajib.');

  const client = await one<{ id: string; name: string }>(
    'SELECT id, name FROM hub_clients WHERE id = $1',
    [appId],
  );
  if (!client) return jsonError(404, 'app_not_found', 'Aplikasi tidak dikenal.');

  const target = await one<{ id: string; email: string }>(
    'SELECT id, email FROM hub_users WHERE id = $1',
    [userId],
  );
  if (!target) return jsonError(404, 'user_not_found', 'Pengguna tidak dikenal.');

  // A role must come from the app's own vocabulary — otherwise a typo silently
  // creates a role no app understands.
  if (role !== null && role !== '' && !(VOCABULARY[appId] ?? []).includes(role)) {
    return jsonError(400, 'unknown_role', `Peran "${role}" tidak dikenal di ${client.name}.`);
  }

  const before = await one<{ role: string }>(
    'SELECT role FROM hub_app_roles WHERE user_id = $1 AND app_id = $2',
    [userId, appId],
  );

  // --- AC7: never strand an app without an admin -----------------------------
  const losingAdmin =
    !!before &&
    ADMIN_ROLES.has(before.role.toLowerCase()) &&
    !(role && ADMIN_ROLES.has(role.toLowerCase()));

  if (losingAdmin) {
    const admins = await query<{ user_id: string }>(
      'SELECT user_id FROM hub_app_roles WHERE app_id = $1 AND lower(role) = ANY($2::text[])',
      [appId, [...ADMIN_ROLES]],
    );
    if (admins.length <= 1) {
      return jsonError(
        409,
        'last_admin',
        `${target.email} adalah admin terakhir di ${client.name}. Angkat admin lain dulu sebelum mengubah peran ini.`,
      );
    }
  }

  if (role === null || role === '') {
    await query('DELETE FROM hub_app_roles WHERE user_id = $1 AND app_id = $2', [userId, appId]);
  } else {
    await query(
      `INSERT INTO hub_app_roles (user_id, app_id, role, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, app_id) DO UPDATE SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by`,
      [userId, appId, role, me.id],
    );
  }

  // AC3: who changed what, when.
  await audit(me.id, before ? 'role.change' : 'role.grant', target.email, {
    app: client.id,
    from: before?.role ?? null,
    to: role,
    actor: me.email,
  });

  return NextResponse.json({ ok: true, userId, appId, from: before?.role ?? null, to: role });
}
