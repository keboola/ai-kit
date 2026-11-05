// record-composite.mjs — screen-records compositor.html playing a source clip
// with overlays and variable pacing, or a static scene the spotlight tours.
// Part of the docs-clip skill; run it from anywhere.
// Usage: node scripts/record-composite.mjs <clip-id> <src-mp4> <width> <height>
import path from 'node:path';
import os from 'node:os';
// Playwright comes from the docs worktree you run this in; PLAYWRIGHT_PATH overrides.
import { existsSync } from 'node:fs';
const PW = process.env.PLAYWRIGHT_PATH ?? path.join(process.cwd(), 'node_modules', 'playwright', 'index.mjs');
if (!existsSync(PW)) { console.error(`playwright not found at ${PW}: run from a docs worktree (npm install) or set PLAYWRIGHT_PATH`); process.exit(2); }
const { chromium } = await import('file://' + PW);

// clip mode:  node record-composite.mjs <clip-id> <src-mp4> <w> <h>
// scene mode: node record-composite.mjs --scene <scene-id> <bg-image> <w> <h>
// page mode:  node record-composite.mjs --page <page.html> <image> <w> <h>
//             records another page in this folder (explainer.html); it gets the image as ?img=
const sceneMode = process.argv[2] === '--scene';
const pageMode = process.argv[2] === '--page';
const [id, src, w, h] = process.argv.slice(sceneMode || pageMode ? 3 : 2);
const OUT = process.env.REC_OUT || path.join(os.tmpdir(), 'docs-clip-rec');  // || not ??: an empty REC_OUT writes into cwd
const size = { width: Number(w), height: Number(h) };

const b = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: size, recordVideo: { dir: OUT, size } });
const p = await ctx.newPage();
const fileArg = encodeURIComponent('file://' + path.resolve(src));
const url = 'file://' + path.resolve(new URL(pageMode ? id : 'compositor.html', import.meta.url).pathname) +
  (pageMode ? `?img=${fileArg}` : sceneMode ? `?scene=${id}&bg=${fileArg}` : `?clip=${id}&src=${fileArg}`);
await p.goto(url);
if (pageMode) {
  await p.waitForFunction(() => typeof window.start === 'function' && [...document.images].every(i => i.complete), null, { timeout: 20000 });
} else if (sceneMode) {
  await p.waitForFunction(() => document.querySelector('img')?.complete, null, { timeout: 20000 });
} else {
  await p.waitForFunction(() => document.getElementById('v').readyState >= 3, null, { timeout: 20000 });
}
await p.evaluate(() => window.start());
if (!sceneMode && !pageMode) {
  // sanity: is the video actually advancing?
  await p.waitForTimeout(1500);
  const probe = await p.evaluate(() => ({ t: document.getElementById('v').currentTime, title: document.title }));
  if (probe.t < 0.2) { console.error('STALLED: video not advancing', JSON.stringify(probe)); await b.close(); process.exit(1); }
}
await p.waitForFunction(() => document.title === 'COMPOSITE-DONE', null, { timeout: 120000 });
const video = p.video();
await ctx.close();
console.log(`clip=${id} webm=${await video.path()}`);
await b.close();
