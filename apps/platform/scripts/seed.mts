#!/usr/bin/env node
/**
 * Idempotent seed. Every insert is ON CONFLICT DO NOTHING/DO UPDATE.
 */
import { pool, query } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';

console.log('seeding platform...');

const org = { id: 'seed-org-1', name: 'Seed Org', slug: 'seed-org' };
await query(
  `INSERT INTO organizations (id, name, slug, plan)
   VALUES ($1, $2, $3, 'pro')
   ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, plan = EXCLUDED.plan`,
  [org.id, org.name, org.slug],
);

// 2 demo users
const users = [
  { email: 'admin@seed.dev', pw: 'seedadmin123', name: 'Admin Seed', role: 'admin' },
  { email: 'builder@seed.dev', pw: 'seedbuild123', name: 'Builder Seed', role: 'builder' },
];

const ids = {} as Record<string, string>;
for (const u of users) {
  const existing = await query('SELECT id FROM users WHERE email = $1', [u.email]);
  if (existing.rows.length) {
    ids[u.email] = existing.rows[0].id;
    continue;
  }
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO users (id, email, name, org_id, role, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [id, u.email, u.name, org.id, u.role, await hashPassword(u.pw)],
  );
  ids[u.email] = id;
  console.log(`  user ${u.email}`);
}

// 2 apps
const apps = [
  { id: 'app-1', name: 'Welcome App', slug: 'welcome', description: 'Demo app for portfolio', order: 0 },
  { id: 'app-2', name: 'CRM Starter', slug: 'crm', description: 'Lightweight CRM', order: 1 },
];
for (const a of apps) {
  await query(
    `INSERT INTO apps (id, org_id, name, slug, description, version, is_published)
     VALUES ($1, $2, $3, $4, $5, 1, true)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
    [a.id, org.id, a.name, a.slug, a.description],
  );
  console.log(`  app ${a.name}`);
}

// 3 pages for app-1
const pages = [
  { id: 'page-1', name: 'Home', route: '/', order: 0 },
  { id: 'page-2', name: 'Dashboard', route: '/dashboard', order: 1 },
  { id: 'page-3', name: 'Settings', route: '/settings', order: 2 },
];
for (const p of pages) {
  await query(
    `INSERT INTO pages (id, app_id, name, route, order_index)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, route = EXCLUDED.route`,
    [p.id, 'app-1', p.name, p.route, p.order],
  );
}

// Sample data rows for app-1
await query(
  `INSERT INTO app_data_rows (id, app_id, row_json, created_by)
   VALUES ($1, 'app-1', '{"name":"Alice","email":"alice@example.com","plan":"pro"}'::jsonb, $2)
   ON CONFLICT (id) DO NOTHING`,
  ['row-1', ids['admin@seed.dev']],
);
await query(
  `INSERT INTO app_data_rows (id, app_id, row_json, created_by)
   VALUES ($1, 'app-1', '{"name":"Bob","email":"bob@example.com","plan":"free"}'::jsonb, $2)
   ON CONFLICT (id) DO NOTHING`,
  ['row-2', ids['admin@seed.dev']],
);

console.log('seed complete');
await pool.end();
