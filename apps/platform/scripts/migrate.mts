#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from '../src/lib/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '../migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf-8');
  await query(sql);
  console.log(`  applied ${f}`);
}

await query(`CREATE TABLE IF NOT EXISTS _migrated (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())`);
console.log('migrate complete');
await pool.end();
