import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync('../../.env', 'utf-8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);

const pool = new pg.Pool({ connectionString: env.PLATFORM_DATABASE_URL });
const t = await pool.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
);
console.log('TABLES:', t.rows.map((r) => r.table_name).join(', '));

for (const name of ['workflows', 'workflow_steps', 'workflow_runs']) {
  const c = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
    [name]
  );
  if (!c.rows.length) { console.log(`\n${name}: MISSING`); continue; }
  console.log(`\n${name}:`);
  for (const r of c.rows) console.log(`  ${r.column_name} ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
  const i = await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename=$1`, [name]);
  for (const r of i.rows) console.log(`  IDX ${r.indexdef}`);
  const n = await pool.query(`SELECT COUNT(*) FROM ${name}`);
  console.log(`  ROWS ${n.rows[0].count}`);
}

for (const name of ['workflow_runs', 'workflow_run_steps', 'cron_jobs']) {
  const c = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [name]
  );
  console.log(`${name} exists: ${c.rows.length > 0}`);
}
await pool.end();
