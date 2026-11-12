// record.mjs — local-only clip recorder for docs "GIFs" (looping mp4s). NOT committed (gitignored).
// Usage: node scripts/record.mjs <clip-id>
// Records a Playwright session (saved login from ~/.keboola-shots/state.json) to webm in $OUT.
// Post-process with scripts/postgif.sh (speedup + scale + h264 + poster).
import path from 'node:path';
import os from 'node:os';
// Playwright comes from the docs worktree you run this in; PLAYWRIGHT_PATH overrides.
import { existsSync } from 'node:fs';
const PW = process.env.PLAYWRIGHT_PATH ?? path.join(process.cwd(), 'node_modules', 'playwright', 'index.mjs');
if (!existsSync(PW)) { console.error(`playwright not found at ${PW}: run from a docs worktree (npm install) or set PLAYWRIGHT_PATH`); process.exit(2); }
const { chromium } = await import('file://' + PW);

const HOST = process.env.KBC_HOST ?? 'https://connection.europe-west3.gcp.keboola.com';
const PROJECT = process.env.KBC_PROJECT ?? '264';
const STATE = path.join(os.homedir(), '.keboola-shots', 'state.json');
const OUT = process.env.REC_OUT || path.join(os.tmpdir(), 'docs-clip-rec');  // || not ??: an empty REC_OUT writes into cwd

const clips = {
  // Step 5 finale: ask Kai the arc's question (read-only — no approvals)
  'kai-ask-basin': {
    size: { width: 1440, height: 900 },
    run: async (p, helpers) => {
      await p.goto(`${HOST}/admin/projects/${PROJECT}/storage/out.c-octopus-atlas/table/octopus_atlas`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForTimeout(6000);
      await helpers.killToast();
      // open Kai Agent from the top bar
      await p.locator('button:has-text("Kai Agent")').first().click();
      await p.waitForTimeout(4000);
      await helpers.killToast();
      const input = p.locator('[contenteditable="true"]:visible, textarea[placeholder*="essage"]:visible, div[role="textbox"]:visible').last();
      await input.click();
      await input.type('Using out.c-octopus-atlas.octopus_atlas, answer this: which ocean basin has the most recorded octopus sightings, what share of all 10,000 sightings does it carry, and how many distinct species were recorded there?', { delay: 18 });
      await p.waitForTimeout(600);
      await p.keyboard.press('Enter');
      // wait for the answer: poll until chat mentions North Atlantic or 2,632, cap 150s
      for (let i = 0; i < 30; i++) {
        await p.waitForTimeout(5000);
        const t = await p.locator('body').innerText();
        if (/North Atlantic/.test(t) && /2[,.]?632|26\s?%/.test(t)) { break; }
      }
      await p.waitForTimeout(5000); // linger on the answer
    },
  },

  // Step 4: Kai writes the atlas into the existing Sheets configuration (docs prompt, updates + runs)
  'kai-write': {
    size: { width: 1440, height: 900 },
    run: async (p, helpers) => {
      await p.goto(`${HOST}/admin/projects/${PROJECT}/components/keboola.wr-google-sheets/01m0w7ghbsezptwdb0rhhzs7ee`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForTimeout(6000);
      await helpers.killToast();
      await p.locator('button:has-text("Kai Agent")').first().click();
      await p.waitForTimeout(4000);
      await helpers.killToast();
      const input = p.locator('[contenteditable="true"]:visible, textarea[placeholder*="essage"]:visible, div[role="textbox"]:visible').last();
      await input.click();
      await input.type('In my "[TUTORIAL] Octopus atlas to Sheets" configuration, write out.c-octopus-atlas.octopus_atlas to the spreadsheet "[TUTORIAL] Octopus atlas", into a sheet named octopus_atlas, set to update rows rather than append. Then run it.', { delay: 16 });
      await p.waitForTimeout(600);
      await p.keyboard.press('Enter');
      let quiet = 0;
      for (let i = 0; i < 50; i++) { // ~5 min cap, approve as needed
        await p.waitForTimeout(6000);
        const approve = p.locator('button:has-text("Approve")');
        if (await approve.count()) { await approve.first().click(); quiet = 0; continue; }
        const t = await p.locator('body').innerText();
        const busy = /Thinking|Working|Updating configuration|Running|Creating|Querying/i.test(t);
        quiet = busy ? 0 : quiet + 1;
        if (quiet >= 3) break; // ~18s with no approvals and no activity = Kai is done
      }
      await p.waitForTimeout(5000);
    },
  },
  // Step 6: using the finished app — type Prague coordinates, nearest sighting appears
  'app-preview': {
    size: { width: 1600, height: 950 },
    run: async (p, helpers) => {
      await p.goto(`${HOST}/admin/projects/${PROJECT}/data-apps/01m0wc5kzrmgkgp792fd3cpjbx`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForTimeout(8000);
      await helpers.killToast();
      await p.locator('text=Drafts').first().click();
      await p.waitForTimeout(2500);
      await helpers.killToast();
      await p.locator('text=[TUTORIAL] Octopus map (draft)').first().click();
      // make sure the Preview pane is fronted (cold drafts may open without it)
      await p.waitForTimeout(8000);
      const previewBtn = p.locator('button:has-text("Preview")').first();
      if (await previewBtn.count()) { await previewBtn.click().catch(()=>{}); }
      // the app preview lives in an iframe — find the frame that has the lat placeholder
      let app = null;
      for (let i = 0; i < 24 && !app; i++) {
        await p.waitForTimeout(5000);
        await helpers.killToast();
        for (const f of p.frames()) {
          try { if (await f.locator('input[placeholder*="35.6762"]').count()) { app = f; break; } } catch {}
        }
      }
      if (!app) throw new Error('app preview frame never appeared');
      await p.waitForTimeout(3000);
      const lat = app.locator('input[placeholder*="35.6762"]').first();
      const lon = app.locator('input[placeholder*="139.6503"]').first();
      await lat.click(); await lat.type('50.08', { delay: 140 });
      await p.waitForTimeout(900);
      await lon.click(); await lon.type('14.43', { delay: 140 });
      await p.waitForTimeout(1200);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(8000); // linger on the nearest-sighting result
    },
  },
};

const id = process.argv[2];
const clip = clips[id];
if (!clip) { console.error('unknown clip. available:', Object.keys(clips).join(', ')); process.exit(1); }

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({
  storageState: STATE,
  viewport: clip.size,
  recordVideo: { dir: OUT, size: clip.size },
});
const p = await ctx.newPage();
const helpers = {
  killToast: () => p.evaluate(() => document.querySelectorAll('div.tw\\:fixed.tw\\:bottom-4.tw\\:left-16').forEach(e => e.remove())).catch(() => {}),
};
const t0 = Date.now();
try {
  await clip.run(p, helpers);
} finally {
  const video = p.video();
  await ctx.close(); // flushes the webm
  const file = await video.path();
  console.log(`clip=${id} seconds=${Math.round((Date.now() - t0) / 1000)} webm=${file}`);
  await b.close();
}
