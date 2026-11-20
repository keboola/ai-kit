#!/usr/bin/env node
// shoot-cdp.mjs: capture a screenshot from YOUR already-open Chrome (real, logged-in session).
// Part of the keboola-docs plugin (capturing-keboola-ui-screenshots). Moved from the docs checkout's
// gitignored apps-section/ bundle on 2026-10-14 and generalised to any section.
//
// WHY: a fresh Playwright browser gets blocked by Google SSO. Connecting to your real Chrome over
// CDP reuses your existing Keboola login: no re-login, nothing to hand over.
//
// ONE-TIME (you): start a second Chrome with its own profile and the debug port open:
//   open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.keboola-shots/chrome-cdp"
// Chrome 136+ ignores --remote-debugging-port on the default profile (a security change), so the
// separate --user-data-dir is required. -n opens it next to your normal Chrome; nothing to quit.
// Log into Keboola once in that window; the profile keeps the session for next time.
//
// USAGE (from a connection-docs worktree, or point at one with --root / KEBOOLA_DOCS_ROOT):
//   node <plugin>/skills/capturing-keboola-ui-screenshots/scripts/shoot-cdp.mjs [--root <docs worktree>] [--width 1100] <url|current> <section/outname.png> [waitMs] [full]
//     url        navigate a new tab to this URL, then shoot (the tab is closed afterwards)
//     current    shoot the Keboola tab you already have open (for states you drove to)
//     outname    saved to public/<section/outname.png>; the section is required
//     --width    viewport width in CSS px for a new tab (default 1100); the shot is always 2x
//     waitMs     settle time before the shot (default 2500; raise for heavy apps)
//     full       the literal word "full" for a full-page shot
// Env: CDP_URL (default http://localhost:9222), PLAYWRIGHT_PATH (default ./node_modules/playwright).
//
// Example:
//   node …/shoot-cdp.mjs "https://connection.europe-west3.gcp.keboola.com/admin/projects/264/data-apps" data-apps/apps-list.png
//   node …/shoot-cdp.mjs current getting-started/kai-build.png 1500
//
// Before committing a shot: read references/keboola-ui-capture.md (names, top bar, toast, 2x).
// A tab opened over CDP renders at 1x and stops painting while its window is covered (field test
// 2026-10-15), so the script sets device scale 2 and focus emulation itself and fronts the tab.
// For the states of a GIF use docs-clip/scripts/capture-states.mjs instead.

import path from 'node:path';
import fs from 'node:fs';

// The docs worktree: --root <dir>, else KEBOOLA_DOCS_ROOT, else the current directory.
const argv = process.argv.slice(2);
const ri = argv.indexOf('--root');
const ROOT = path.resolve(ri >= 0 ? argv.splice(ri, 2)[1] : (process.env.KEBOOLA_DOCS_ROOT ?? process.cwd()));
const wi = argv.indexOf('--width');
const WIDTH = wi >= 0 ? Number(argv.splice(wi, 2)[1]) : 1100;
const isDocs = (d) => fs.existsSync(path.join(d, 'src', 'content', 'docs')) && fs.existsSync(path.join(d, 'public'));
if (!isDocs(ROOT)) {
  console.error(`${ROOT} is not a connection-docs worktree (no src/content/docs and public/).\n` +
    `cd into one first, e.g.:  cd ~/keboola-docs && node <this script> current storage/x.png\n` +
    `or pass it:               node <this script> --root ~/keboola-docs current storage/x.png\n` +
    `or once per shell:        export KEBOOLA_DOCS_ROOT=~/keboola-docs`);
  process.exit(2);
}
const PW = process.env.PLAYWRIGHT_PATH ?? path.join(ROOT, 'node_modules', 'playwright', 'index.mjs');
if (!fs.existsSync(PW)) { console.error(`playwright not found at ${PW}: run npm install in ${ROOT}, or set PLAYWRIGHT_PATH`); process.exit(2); }
const { chromium } = await import('file://' + PW);
const CDP = process.env.CDP_URL ?? 'http://localhost:9222';

const [target, outnameArg, waitMsArg, fullArg] = argv;
if (!target || !outnameArg) {
  console.error('usage: node shoot-cdp.mjs [--root <docs worktree>] <url|current> <section/outname.png> [waitMs] [full]');
  process.exit(1);
}
const PUBLIC = path.join(ROOT, 'public');
if (!outnameArg.includes('/')) { console.error(`name the section: <section>/${outnameArg} (the shot goes to public/<section>/)`); process.exit(1); }
const outname = outnameArg;
const out = path.join(PUBLIC, outname);
fs.mkdirSync(path.dirname(out), { recursive: true });
const waitMs = Number(waitMsArg ?? 2500);
const fullPage = fullArg === 'full';

let browser;
try {
  browser = await chromium.connectOverCDP(CDP);
} catch {
  console.error(`Could not connect to Chrome on ${CDP}.\nStart a debug Chrome with its own profile (Chrome 136+ refuses the port on the default one):\n  open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.keboola-shots/chrome-cdp"\nthen log into Keboola in that window and run this again.`);
  process.exit(1);
}

const ctx = browser.contexts().find((c) => c.pages().some((p) => p.url().includes('keboola.com'))) ?? browser.contexts()[0];
if (!ctx) {
  console.error('Connected, but no browser context found. Is a Chrome window open and logged in?');
  process.exit(1);
}

let page;
let openedTab = false;
if (target === 'current') {
  const pages = ctx.pages().filter((p) => p.url().includes('keboola.com'));
  page = pages[pages.length - 1] ?? ctx.pages().at(-1);
  if (!page) { console.error('No open tab to capture.'); process.exit(1); }
} else {
  page = await ctx.newPage();
  openedTab = true;
}
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
if (openedTab) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 2, mobile: false });
  await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
}
await cdp.send('Page.bringToFront');
await page.waitForTimeout(waitMs);
await page.screenshot({ path: out, fullPage, timeout: 30000 });
console.log('saved →', out, '   (url:', page.url() + ')');

if (openedTab) await page.close();
await browser.close(); // disconnects CDP only; does NOT close your Chrome
