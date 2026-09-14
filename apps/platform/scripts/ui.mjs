#!/usr/bin/env node
/**
 * Browser test for the Platform app.
 */
import { chromium } from 'playwright';

const BASE = process.env.PLATFORM_BASE_URL || 'http://localhost:3001';
const results = [];
let shot = 0;

function record(ac, name, pass, detail = '') {
  results.push({ ac, name, pass, detail });
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${ac.padEnd(14)} ${name}${detail ? `  — ${detail}` : ''}`);
}

async function goto(page, path) {
  const r = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForLoadState('load').catch(() => {});
  return r?.status();
}

async function waitForVisible(selector, timeout = 8000) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shotPage(name) {
  await page.screenshot({ path: `shots/ui-${String(++shot).padStart(2, '0')}-${name}.png` });
}

// ── US-A02 AC1: login page ------------------------------------------------
{
  const s = await goto(page, '/login');
  record('US-A02 AC1', 'login page renders', s === 200, `status=${s}`);
  const hasForm = await page.locator('input[type="email"], input[name="email"]').count() > 0;
  record('US-A02 AC1', 'login form present', hasForm);
  await shotPage('login');
}

// ── US-A02 AC2: wrong password --------------------------------------------
{
  await waitForVisible('#email');
  await page.fill('#email', 'admin@seed.dev');
  await page.fill('#password', 'wrongpassword');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  const url = page.url();
  record('US-A02 AC2', 'wrong password refused', url.includes('/login'), `url=${url}`);
}

// ── US-A02 AC1: correct password ------------------------------------------
{
  await goto(page, '/login');
  await waitForVisible('#email');
  await page.fill('#email', 'admin@seed.dev');
  await page.fill('#password', 'seedadmin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  const url = page.url();
  record('US-A02 AC1', 'correct password logs in', url.includes('/apps'), `url=${url}`);
  await shotPage('apps');
}

// ── US-A06 AC1: apps page -------------------------------------------------
{
  const rows = await page.locator('table tbody tr, [class*="app"]').count();
  const hasAppText = await page.getByText(/Test App|Welcome App|CRM Starter/).count() > 0;
  record('US-A06 AC1', 'apps list populated', rows >= 2 || hasAppText, `rows=${rows} hasAppText=${hasAppText}`);
}

// ── US-A29 AC1: health ----------------------------------------------------
{
  const s = await goto(page, '/health');
  record('US-A29 AC1', '/health renders', s === 200, `status=${s}`);
}

// ── guard: anon (US-A02 AC4 / US-A04 AC5) ---------------------------------
{
  await page.context().clearCookies();
  const s = await goto(page, '/apps');
  const url = page.url();
  record('US-A02 AC4', 'anon -> login', url.includes('/login'), `url=${url}`);
}

await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
