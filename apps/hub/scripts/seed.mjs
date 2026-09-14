#!/usr/bin/env node
/**
 * Seed the Hub. Idempotent — running twice must not duplicate anything
 * (US-M02 AC4). Every insert is ON CONFLICT DO NOTHING / DO UPDATE.
 *
 *   node scripts/seed.mjs
 *
 * Clients are registered from the CLIENT_ID/CLIENT_SECRET pairs in .env, so the
 * app side and the Hub side cannot drift: change .env, re-seed, both agree.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { createHash, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

const scryptAsync = promisify(scrypt);
const HERE = dirname(fileURLToPath(import.meta.url));

// Load the monorepo .env (Next loads it for the app; plain node does not).
const envPath = resolve(HERE, '../../../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = process.env.HUB_DATABASE_URL;
if (!url) {
  console.error('HUB_DATABASE_URL is not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const hash = async (pw) => {
  const salt = randomBytes(16);
  const dk = await scryptAsync(pw, salt, 32);
  return `scrypt$16384$8$1$${salt.toString('base64')}$${dk.toString('base64')}`;
};

// --- clients ---------------------------------------------------------------
// redirect_uris is exact-match. Both the app's own callback and the Hub's
// "pick an app" handoff land here, so list each explicitly.
const CLIENTS = [
  {
    id: process.env.HUB_CLIENT_ID || 'portico_hub',
    name: 'Portico Hub',
    secret: process.env.HUB_CLIENT_SECRET || 'dev-hub-secret',
    uris: [`${process.env.HUB_BASE_URL || 'http://localhost:3100'}/api/auth/hub/callback`],
  },
  {
    id: process.env.PLATFORM_CLIENT_ID || 'platform',
    name: 'Platform',
    secret: process.env.PLATFORM_CLIENT_SECRET || 'dev-platform-secret',
    uris: [`${process.env.PLATFORM_BASE_URL || 'http://localhost:3001'}/api/auth/hub/callback`],
  },
  {
    id: process.env.HELPDESK_CLIENT_ID || 'helpdesk',
    name: 'Helpdesk',
    secret: process.env.HELPDESK_CLIENT_SECRET || 'dev-helpdesk-secret',
    uris: [`${process.env.HELPDESK_BASE_URL || 'http://localhost:3002'}/api/auth/hub/callback`],
  },
  {
    id: process.env.CODEREVIEW_CLIENT_ID || 'code-review',
    name: 'Code Review',
    secret: process.env.CODEREVIEW_CLIENT_SECRET || 'dev-codereview-secret',
    uris: [`${process.env.CODEREVIEW_BASE_URL || 'http://localhost:3003'}/api/auth/hub/callback`],
  },
];

for (const c of CLIENTS) {
  await client.query(
    `INSERT INTO hub_clients (id, name, redirect_uris, secret_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           redirect_uris = EXCLUDED.redirect_uris,
           secret_hash = EXCLUDED.secret_hash`,
    [c.id, c.name, c.uris, createHash('sha256').update(c.secret).digest('hex')],
  );
  console.log(`  client   ${c.id.padEnd(12)} ${c.uris.join(', ')}`);
}

// --- demo users ------------------------------------------------------------
// US-M01 AC2: a demo account must be stated plainly on the login page.
const DEMO = [
  { email: 'demo@portico.dev', pw: 'demo1234', name: 'Demo Reviewer', roles: { platform: 'admin', helpdesk: 'agent', 'code-review': 'reviewer' } },
  { email: 'owner@portico.dev', pw: 'owner1234', name: 'Reza Fahreza', roles: { platform: 'owner', helpdesk: 'admin', 'code-review': 'lead' } },
  { email: 'viewer@portico.dev', pw: 'viewer1234', name: 'Aisyah Putri', roles: { platform: 'viewer' } },
];

for (const u of DEMO) {
  const res = await client.query(
    `INSERT INTO hub_users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [u.email, await hash(u.pw), u.name],
  );
  const userId = res.rows[0].id;
  for (const [appId, role] of Object.entries(u.roles)) {
    await client.query(
      `INSERT INTO hub_app_roles (user_id, app_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, app_id) DO UPDATE SET role = EXCLUDED.role`,
      [userId, appId, role],
    );
  }
  console.log(`  user     ${u.email.padEnd(20)} roles=${JSON.stringify(u.roles)}`);
}

const counts = await client.query(`
  SELECT
    (SELECT count(*) FROM hub_users)         AS users,
    (SELECT count(*) FROM hub_clients)       AS clients,
    (SELECT count(*) FROM hub_app_roles)     AS roles,
    (SELECT count(*) FROM hub_signing_keys)  AS keys
`);
console.log('\nstate:', counts.rows[0]);
await client.end();
