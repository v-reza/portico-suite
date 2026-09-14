#!/usr/bin/env node
/**
 * Run every migrations/*.sql in filename order. Idempotent: each file uses
 * IF NOT EXISTS, and applied names are recorded so a re-run is a no-op.
 *
 *   node scripts/migrate.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, '../migrations');

const url = process.env.HUB_DATABASE_URL;
if (!url) {
  console.error('HUB_DATABASE_URL is not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name       text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const applied = new Set(
  (await client.query('SELECT name FROM _migrations')).rows.map((r) => r.name),
);

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
let ran = 0;

for (const f of files) {
  if (applied.has(f)) {
    console.log(`  skip     ${f}`);
    continue;
  }
  const sql = readFileSync(join(DIR, f), 'utf8');
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [f]);
    await client.query('COMMIT');
    console.log(`  applied  ${f}`);
    ran++;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  FAILED   ${f}: ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

console.log(`\n${ran} applied, ${files.length - ran} already current`);
await client.end();
