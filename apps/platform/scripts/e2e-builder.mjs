#!/usr/bin/env node
/**
 * Browser test for US-A09 — drag & drop component insertion.
 *
 * The ACs here are browser-level claims (a drag lands where it was released, an
 * empty canvas shows the hint, a drop outside creates nothing), so they cannot
 * be proven by calling the API. The API half — ordering, the 15 ceiling, the
 * settings read-back — lives in e2e-features.mjs.
 *
 * Run: set -a && . ../../.env && set +a && node scripts/e2e-builder.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3001';
const results = [];
let shot = 0;

function record(ac, name, pass, detail = '') {
  results.push({ ac, name, pass, detail });
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${ac.padEnd(12)} ${name}${detail ? `  — ${detail}` : ''}`);
}

/**
 * `domcontentloaded` with a generous timeout: the first hit on a route pays for
 * the dev server's compile (20s+ here), and a 20s budget turns that into a
 * navigation timeout that reads exactly like a broken page.
 */
async function goto(page, path) {
  const r = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  return r?.status();
}

async function shotPage(name) {
  await page.screenshot({ path: `shots/builder-${String(++shot).padStart(2, '0')}-${name}.png` });
}

/**
 * HTML5 drag & drop cannot be driven with `page.dragAndDrop` reliably here —
 * Playwright's synthesized drag uses the same DataTransfer API, but the canvas
 * only accepts a payload carrying our custom MIME type, so the test has to build
 * the same DataTransfer the palette sets up. Dispatching the four real drag
 * events in order (dragstart on the source, then dragover/drop on the target) is
 * what the browser itself does; anything less and the handler never sees the
 * payload.
 */
async function dragPaletteTo(page, type, targetSelector, offsetY = 0) {
  return page.evaluate(({ type, targetSelector, offsetY }) => {
    const source = document.querySelector(`[data-palette-item="${type}"]`);
    const target = document.querySelector(targetSelector);
    if (!source || !target) return { ok: false, why: `source=${!!source} target=${!!target}` };

    const dt = new DataTransfer();
    const box = target.getBoundingClientRect();
    const at = { x: box.left + box.width / 2, y: box.top + offsetY, clientY: box.top + offsetY };

    const fire = (el, name, extra = {}) => {
      const ev = new DragEvent(name, {
        bubbles: true, cancelable: true, dataTransfer: dt,
        clientX: at.x, clientY: at.y, ...extra,
      });
      el.dispatchEvent(ev);
      return ev;
    };

    fire(source, 'dragstart');
    const over = fire(target, 'dragover');
    fire(target, 'drop');
    fire(source, 'dragend');
    return { ok: true, accepted: over.defaultPrevented, y: at.clientY };
  }, { type, targetSelector, offsetY });
}

/**
 * Wait for the canvas to hold exactly `n` components. A fixed sleep here races
 * the create request AND the follow-up re-read, and the resulting "the drop did
 * nothing" is indistinguishable from a real bug — so wait on the outcome.
 */
async function waitForRows(page, n, timeout = 20000) {
  await page.waitForFunction(
    (want) => document.querySelectorAll('[data-component-row]').length === want,
    n, { timeout },
  ).catch(() => {});
  return page.locator('[data-component-row]').count();
}

/** The component order the canvas is showing, top to bottom. */
async function canvasOrder(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('[data-component-row]'))
    .map((r) => r.getAttribute('aria-selected') === 'true' ? 'SELECTED' : 'row'));
}

/** The labels the canvas is rendering, in order — proves the order visually. */
async function canvasLabels(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('[data-component-row]'))
    .map((r) => (r.textContent || '').trim().slice(0, 40)));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// A native dialog is a card failure (the standard bans them outright). Playwright
// silently dismisses them, which would hide the defect, so record them instead.
const nativeDialogs = [];
page.on('dialog', async (d) => {
  nativeDialogs.push(`${d.type()}: ${d.message()}`);
  await d.dismiss().catch(() => {});
});

// ── fixture: a signed-in session and a draft app with one page ─────────────
let appId = null;
{
  await goto(page, '/login');
  await page.waitForSelector('#email', { timeout: 15000 });
  await page.fill('#email', 'admin@seed.dev');
  await page.fill('#password', 'seedadmin123');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname.startsWith('/apps'), { timeout: 20000 }).catch(() => {});

  const created = await page.request.post(`${BASE}/api/apps`, {
    data: { name: `Builder DnD ${Date.now()}`, description: 'US-A09 browser fixtures' },
  });
  appId = (await created.json())?.app?.id ?? null;
  const pageRes = await page.request.post(`${BASE}/api/apps/${appId}/pages`, {
    data: { name: 'Beranda', route: '/' },
  });
  const pageId = (await pageRes.json())?.page?.id ?? null;
  record('US-A09 AC1', 'a draft app with one page exists to build in',
    created.status() === 201 && pageRes.status() === 201, `app=${appId} page=${pageId}`);
}

// ── US-A09 AC2: an empty canvas is a labelled drop area, not a blank one ───
{
  // Warm the builder route first: the first compile takes 20s+ and would
  // otherwise be charged to the first assertion below.
  await goto(page, `/apps/${appId}`);
  const s = await goto(page, `/apps/${appId}`);
  record('US-A09 AC1', 'the builder opens on the app', s === 200, `status=${s}`);
  const empty = page.locator('[data-canvas-empty]');
  await empty.waitFor({ state: 'visible', timeout: 20000 });
  const text = (await empty.innerText()).replace(/\s+/g, ' ').trim();
  record('US-A09 AC2', 'an empty canvas renders the drop hint, not a blank area',
    text.includes('geser komponen ke sini'), `text=${JSON.stringify(text)}`);
  record('US-A09 AC2', 'the empty canvas is not rendered as a black/empty box',
    (await page.locator('[data-canvas-empty]').count()) === 1 && text.length > 0);
  await shotPage('empty-canvas');
}

// ── US-A09 AC1: a drop lands where it was released, and selects it ─────────
{
  // Drop "text" into the empty canvas.
  const r = await dragPaletteTo(page, 'text', '[data-builder-canvas]', 40);
  record('US-A09 AC1', 'the canvas accepted the drag (dragover was preventDefault-ed)',
    r.ok && r.accepted === true, `ok=${r.ok} accepted=${r.accepted} ${r.why ?? ''}`);

  await page.locator('[data-component-row]').first().waitFor({ state: 'visible', timeout: 15000 });
  record('US-A09 AC1', 'dropping "text" on the canvas created exactly one component',
    (await page.locator('[data-component-row]').count()) === 1,
    `rows=${await page.locator('[data-component-row]').count()}`);

  // "langsung muncul di panel properti" — the dropped row is the selected one
  // and the inspector is describing it, not an empty state.
  const selectedRow = page.locator('[data-component-row][aria-selected="true"]');
  record('US-A09 AC1', 'the dropped component is the selected one on the canvas',
    (await selectedRow.count()) === 1, `selected=${await selectedRow.count()}`);
  record('US-A09 AC1', 'the property panel is showing that component (not the empty hint)',
    (await page.locator('#inspector-label').count()) === 1
      && (await page.locator('text=Pilih komponen di canvas untuk melihat properti.').count()) === 0);
  await shotPage('first-drop');
}

// ── US-A09 AC1: order — a drop at the top of the stack lands first ─────────
{
  // Two more appended, then insert a heading above everything.
  // Types must exist in the palette: a name that is not rendered there makes
  // the drag a no-op and reads exactly like a broken drop handler.
  const add1 = await dragPaletteTo(page, 'textarea', '[data-builder-canvas]', 100000);
  const twoRows = await waitForRows(page, 2);
  const add2 = await dragPaletteTo(page, 'select', '[data-builder-canvas]', 100000);
  const before = await waitForRows(page, 3);
  record('US-A09 AC1', 'three components are on the canvas before the reorder',
    before === 3, `rows=${before} after_first=${twoRows} found=${add1.ok}/${add2.ok}`);

  // Drop a heading into the very top of the artboard (offset 4px = above the
  // midpoint of row 1), which must land at index 0.
  const top = await dragPaletteTo(page, 'heading', '[data-builder-canvas]', 4);
  record('US-A09 AC1', 'a drop at the top of the stack is accepted', top.ok, `ok=${top.ok}`);
  await waitForRows(page, 4);

  const labels = await canvasLabels(page);
  record('US-A09 AC1', 'the component dropped at the top is rendered first, not appended last',
    labels.length === 4 && /Judul Baru/.test(labels[0]),
    `labels=${JSON.stringify(labels.map((l) => l.slice(0, 18)))}`);

  // AC1 says the order persists across a reload — so it is the server's order,
  // not just local state.
  await goto(page, `/apps/${appId}`);
  await page.locator('[data-component-row]').first().waitFor({ state: 'visible', timeout: 20000 });
  const afterReload = await canvasLabels(page);
  record('US-A09 AC1', 'the dropped-at-top order survives a page reload',
    /Judul Baru/.test(afterReload[0] ?? ''), `labels=${JSON.stringify(afterReload.map((l) => l.slice(0, 18)))}`);
  await shotPage('reordered');
}

// ── US-A09 AC3: a drop outside the canvas changes nothing ──────────────────
{
  const before = await page.locator('[data-component-row]').count();
  // The palette itself is a real drop target candidate in a buggy build: a
  // handler on the page root would happily create a component there.
  const onPalette = await dragPaletteTo(page, 'text', 'aside', 200);
  await page.waitForTimeout(700);
  const afterPalette = await page.locator('[data-component-row]').count();

  // And the dotted backdrop next to the artboard.
  const onBackdrop = await dragPaletteTo(page, 'text', 'main', 10);
  await page.waitForTimeout(700);
  const afterBackdrop = await page.locator('[data-component-row]').count();

  record('US-A09 AC3', 'a drop on the palette created no component',
    afterPalette === before, `before=${before} after=${afterPalette} dropped=${onPalette.ok}`);
  record('US-A09 AC3', 'a drop on the dotted backdrop created no component',
    afterBackdrop === before, `before=${before} after=${afterBackdrop} dropped=${onBackdrop.ok}`);

  // Nothing stray reached the database either — the canvas is the only writer.
  const listed = await (await page.request.get(`${BASE}/api/apps/${appId}/pages`)).json();
  const pid = listed.pages[0].id;
  const comps = await (await page.request.get(`${BASE}/api/pages/${pid}/components`)).json();
  record('US-A09 AC3', 'the server holds exactly the components the canvas shows (no stray rows)',
    comps.components.length === before, `server=${comps.components.length} canvas=${before}`);
}

// ── US-A09 AC4: label / placeholder / wajib-isi, visible live ──────────────
{
  // Select the "Input teks" row so the inspector shows its property set.
  const fieldRow = page.locator('[data-component-row]').filter({ hasText: 'Input teks' }).first();
  await fieldRow.click();
  await page.waitForTimeout(400);
  record('US-A09 AC4', 'the inspector exposes an editable label field',
    (await page.locator('#inspector-label').count()) === 1
      && !(await page.locator('#inspector-label').isDisabled()));

  await page.fill('#inspector-label', 'Nama Perusahaan');
  await page.waitForTimeout(500);
  const canvasAfterLabel = await canvasLabels(page);
  record('US-A09 AC4', 'editing the label is reflected on the canvas immediately',
    canvasAfterLabel.some((l) => l.includes('Nama Perusahaan')),
    `canvas=${JSON.stringify(canvasAfterLabel.map((l) => l.slice(0, 24)))}`);

  record('US-A09 AC4', 'the inspector exposes a placeholder field',
    (await page.locator('#inspector-placeholder').count()) === 1);
  await page.fill('#inspector-placeholder', 'mis. PT Maju Bersama');
  await page.waitForTimeout(500);
  record('US-A09 AC4', 'editing the placeholder is reflected on the canvas immediately',
    (await page.locator('[data-builder-canvas]').innerText()).includes('mis. PT Maju Bersama'));

  record('US-A09 AC4', 'the inspector exposes a wajib-isi control',
    (await page.locator('#inspector-required').count()) === 1);
  await page.locator('#inspector-required').check();
  await page.waitForTimeout(500);
  record('US-A09 AC4', 'marking wajib-isi shows a marker on the canvas',
    (await page.locator('[data-required-marker]').count()) === 1,
    `markers=${await page.locator('[data-required-marker]').count()}`);
  await shotPage('properties');

  // AC4 says the settings can be CHANGED — so they must survive a reload.
  await goto(page, `/apps/${appId}`);
  await page.locator('[data-component-row]').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('[data-component-row]').filter({ hasText: 'Nama Perusahaan' }).first().click();
  await page.waitForTimeout(400);
  record('US-A09 AC4', 'the three settings persisted (they read back after a reload)',
    (await page.inputValue('#inspector-label')) === 'Nama Perusahaan'
      && (await page.inputValue('#inspector-placeholder')) === 'mis. PT Maju Bersama'
      && (await page.locator('#inspector-required').isChecked()),
    `label=${await page.inputValue('#inspector-label')} ph=${await page.inputValue('#inspector-placeholder')} required=${await page.locator('#inspector-required').isChecked()}`);
}

// ── US-A09 AC5: the limit is reported in the UI, not as a browser alert ────
{
  // Fill the page to 15 through the API (fast), then drop a 16th by hand: the
  // AC asks for the *user-visible* message on the add that is refused.
  const listed = await (await page.request.get(`${BASE}/api/apps/${appId}/pages`)).json();
  const pid = listed.pages[0].id;
  const existing = (await (await page.request.get(`${BASE}/api/pages/${pid}/components`)).json()).components.length;
  for (let i = existing; i < 15; i++) {
    await page.request.post(`${BASE}/api/pages/${pid}/components`, {
      data: { type: 'text', config_json: { label: `pad-${i}` } },
    });
  }
  await goto(page, `/apps/${appId}`);
  await page.locator('[data-component-row]').first().waitFor({ state: 'visible', timeout: 20000 });
  record('US-A09 AC5', 'the canvas is at the 15-component ceiling',
    (await page.locator('[data-component-row]').count()) === 15,
    `rows=${await page.locator('[data-component-row]').count()}`);

  await dragPaletteTo(page, 'text', '[data-builder-canvas]', 40);
  // Scoped to the artboard on purpose: Next's App Router renders a
  // `<next-route-announcer role="alert">` for screen readers, which is visible
  // and EMPTY, so an unscoped `[role="alert"]` matches that instead of the
  // limit notice and reads as "the message is blank".
  const alert = page.locator('[data-builder-canvas] [role="alert"]').first();
  await alert.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.waitForFunction(
    () => (document.querySelector('[data-builder-canvas] [role="alert"]')?.textContent ?? '').length > 0,
    null, { timeout: 10000 },
  ).catch(() => {});
  const alertText = await alert.textContent().catch(() => null);
  record('US-A09 AC5', 'adding past the limit shows a clear message on screen',
    !!alertText && /15/.test(alertText), `alert=${JSON.stringify(alertText?.trim())}`);
  record('US-A09 AC5', 'the message is a styled panel, not a native browser dialog',
    nativeDialogs.length === 0, `dialogs=${nativeDialogs.join(' | ') || 'none'}`);
  record('US-A09 AC5', 'the 16th component was not added to the canvas',
    (await page.locator('[data-component-row]').count()) === 15,
    `rows=${await page.locator('[data-component-row]').count()}`);
  await shotPage('limit');
}

// ── US-A09 AC6: the addition can be undone ────────────────────────────────
{
  // Undo the last add of THIS session. The page is at the ceiling from the
  // previous block, so drop into a fresh page instead: undo has to be proven on
  // an addition this session made, which is what the AC describes.
  const created = await page.request.post(`${BASE}/api/apps/${appId}/pages`, {
    data: { name: 'Halaman Uji', route: '/undo' },
  });
  const undoPageId = (await created.json())?.page?.id;
  await goto(page, `/apps/${appId}`);
  // Switch to the new page tab.
  // Scoped to the toolbar: the left palette's page list renders the same name.
  await page.locator('header').getByRole('button', { name: 'Halaman Uji', exact: true }).click();
  await page.waitForTimeout(800);
  record('US-A09 AC6', 'a fresh empty page is active for the undo check',
    (await page.locator('[data-canvas-empty]').count()) === 1);

  await dragPaletteTo(page, 'text', '[data-builder-canvas]', 40);
  await page.locator('[data-component-row]').first().waitFor({ state: 'visible', timeout: 15000 });
  record('US-A09 AC6', 'the component was added before undoing',
    (await page.locator('[data-component-row]').count()) === 1);

  await page.locator('[data-undo]').click();
  await page.waitForTimeout(900);
  record('US-A09 AC6', 'undo removes the component from the canvas',
    (await page.locator('[data-component-row]').count()) === 0,
    `rows=${await page.locator('[data-component-row]').count()}`);

  // AC6 is a real rollback: the row must be gone from storage too, or the next
  // load brings the "undone" component back.
  const stored = await (await page.request.get(`${BASE}/api/pages/${undoPageId}/components`)).json();
  record('US-A09 AC6', 'undo removed the row from storage, not just from the screen',
    stored.components.length === 0, `stored=${stored.components.length}`);

  await goto(page, `/apps/${appId}`);
  // Scoped to the toolbar: the left palette's page list renders the same name.
  await page.locator('header').getByRole('button', { name: 'Halaman Uji', exact: true }).click();
  await page.waitForTimeout(800);
  record('US-A09 AC6', 'the undone component does not come back after a reload',
    (await page.locator('[data-component-row]').count()) === 0,
    `rows=${await page.locator('[data-component-row]').count()}`);
  await shotPage('after-undo');
}

record('US-A09 AC1', 'no native browser dialog was opened by any of the above',
  nativeDialogs.length === 0, `dialogs=${nativeDialogs.join(' | ') || 'none'}`);

// ── teardown: the browser checks must not leave fixtures behind ────────────
{
  if (appId) {
    const del = await page.request.delete(`${BASE}/api/apps/${appId}`);
    record('US-A09 AC1', 'the fixture app was deleted', del.status() === 200, `status=${del.status()}`);
  }
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.PLATFORM_DATABASE_URL });
  // Sweep by the fixture prefix, not just this run's id: a run that dies before
  // teardown (a crashed assertion, an aborted navigation) leaves its app behind,
  // and counting only "what did this run leave" would pass while the workspace
  // drifts one row per crash. This is the count the next run has to start clean
  // from, so it must be able to remove its predecessors' leftovers.
  const swept = await pool.query("DELETE FROM apps WHERE name LIKE 'Builder DnD %'");
  // activity_logs does not cascade from apps (the log is a product feature), so
  // a teardown that only deletes the app leaves one more row per run behind.
  const purged = await pool.query(
    `DELETE FROM activity_logs WHERE entity_type = 'app'
       AND NOT EXISTS (SELECT 1 FROM apps a WHERE a.id = activity_logs.entity_id)`);
  const left = await pool.query(
    "SELECT COUNT(*)::int AS n FROM apps WHERE name LIKE 'Builder DnD %'");
  await pool.end();
  record('US-A09 AC1', 'no fixture app row is left in the workspace (including earlier crashes)',
    left.rows[0].n === 0, `leftover=${left.rows[0].n} swept=${swept.rowCount}`);
  console.log(`  --   teardown: swept ${swept.rowCount} fixture app(s), removed ${purged.rowCount} orphaned activity_log row(s)`);
}

await browser.close();
const pass = results.filter((r) => r.pass).length;
const fail = results.length - pass;
console.log(`\n${pass}/${results.length} passed${fail ? `, ${fail} FAILED` : ''}`);
if (fail) {
  console.log('\nfailures:');
  for (const r of results.filter((x) => !x.pass)) console.log(`  ${r.ac}  ${r.name}  (${r.detail})`);
}
process.exit(fail ? 1 : 0);
