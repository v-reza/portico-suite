import { NextResponse, type NextRequest } from 'next/server';
import { one, query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { newSessionId } from '@/lib/session';

/**
 * GET /authorize — start the Authorization Code + PKCE flow.
 *
 * Two things this endpoint must get right:
 *   1. redirect_uri is matched EXACTLY against the client's whitelist. Prefix or
 *      wildcard matching is the classic open-redirect hole.
 *   2. If the user has no session we bounce to /login carrying the full
 *      authorize query as `next`, so the flow resumes after login instead of
 *      dead-ending (US-M10 AC4: no half-finished session).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const clientId = q.get('client_id') ?? '';
  const redirectUri = q.get('redirect_uri') ?? '';
  const state = q.get('state') ?? '';
  const codeChallenge = q.get('code_challenge') ?? '';
  const method = q.get('code_challenge_method') ?? '';
  const responseType = q.get('response_type') ?? '';

  const client = await one<{ id: string; redirect_uris: string[]; is_active: boolean }>(
    'SELECT id, redirect_uris, is_active FROM hub_clients WHERE id = $1',
    [clientId],
  );

  // Unknown client / bad redirect: render an error page, NEVER redirect. A
  // redirect here would be an open redirect.
  if (!client || !client.is_active) {
    return html(400, 'Aplikasi tidak dikenal', 'client_id ini tidak terdaftar atau sedang dinonaktifkan.');
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return html(400, 'redirect_uri tidak cocok', 'redirect_uri harus sama persis dengan yang terdaftar untuk aplikasi ini.');
  }
  if (responseType !== 'code') {
    return html(400, 'response_type tidak didukung', 'Hanya response_type=code yang didukung.');
  }
  if (!state) {
    return html(400, 'state kosong', 'Parameter state wajib ada (perlindungan CSRF).');
  }
  if (!codeChallenge || method !== 'S256') {
    return html(400, 'PKCE wajib', 'code_challenge wajib dengan code_challenge_method=S256.');
  }

  const user = await getSessionUser(req);
  if (!user) {
    // Carry the whole authorize request forward. `next` is our own path, not the
    // client's redirect_uri, so this cannot be used as an open redirect.
    const next = req.nextUrl.pathname + req.nextUrl.search;
    const login = new URL('/login', req.nextUrl.origin);
    login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  }

  // Membership is enforced HERE, on the server — a disabled card in the UI is
  // presentation, not a boundary (US-M11 AC2: "ditolak di server dengan 403").
  // The Hub client itself is exempt so the Hub can sign in to itself.
  if (client.id !== 'portico_hub') {
    const membership = await one<{ role: string }>(
      'SELECT role FROM hub_app_roles WHERE user_id = $1 AND app_id = $2',
      [user.id, client.id],
    );
    if (!membership) {
      return html(
        403,
        'Akses ditolak',
        `Akun ${user.email} tidak punya akses ke aplikasi ini. Hubungi admin di Hub untuk meminta akses.`,
      );
    }
  }

  const code = `ptc_code_${newSessionId()}`;
  await query(
    `INSERT INTO hub_auth_codes (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'S256', now() + interval '10 minutes')`,
    [code, client.id, user.id, redirectUri, codeChallenge],
  );

  const dest = new URL(redirectUri);
  dest.searchParams.set('code', code);
  dest.searchParams.set('state', state);
  return NextResponse.redirect(dest);
}

function html(status: number, title: string, detail: string) {
  return new NextResponse(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${title} — Portico</title>
     <style>body{font:14px/1.5 Inter,system-ui,sans-serif;background:#f7f7f8;color:#101014;
     display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
     .c{width:380px;background:#fff;border:1px solid rgba(15,23,42,.10);border-radius:8px;padding:32px}
     h1{font-size:1.25rem;margin:0 0 12px}p{color:#62676f;margin:0}</style></head>
     <body><div class="c"><h1>${title}</h1><p>${detail}</p></div></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}
