import { NextResponse, type NextRequest } from 'next/server';
import { one, query } from './db';
import { SESSION_COOKIE, parseSessionCookie } from './session';

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  org_id: string;
  role: 'admin' | 'builder' | 'viewer';
}

export async function getSessionUser(req: NextRequest): Promise<PlatformUser | null> {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = parseSessionCookie(raw);
  if (!userId) return null;
  const u = await one(
    'SELECT id, email, name, org_id, role FROM users WHERE id = $1',
    [userId],
  );
  if (!u) return null;
  return u as PlatformUser;
}

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: code, message }, { status });
}

export function can(user: PlatformUser | null, roles: string[]): user is PlatformUser {
  if (!user) return false;
  // Hierarchy: admin >= builder >= viewer. Asking for 'builder' must also admit
  // 'admin' — otherwise an admin cannot build, which is nonsense.
  const rank: Record<PlatformUser['role'], number> = { viewer: 1, builder: 2, admin: 3 };
  const need = Math.min(...roles.map((r) => rank[r as PlatformUser['role']] ?? 99));
  return rank[user.role] >= need;
}
