#!/usr/bin/env node
// capture-states.mjs: the stills of a states GIF, from your own logged-in Chrome over CDP.
//
//   node capture-states.mjs plan.json            # run from a docs worktree (Playwright comes from its node_modules)
//
// Then: ring-frames.py draws the rings, states-to-gif.sh assembles the GIF (see docs-clip/SKILL.md).
//
// The plan (JSON):
//   {
//     "out": "/tmp/frames",                       // where <shot>.png and rings.json go
//     "viewport": [760, 760],                     // CSS px; 760 keeps 14 px UI labels ≥ 13 px in the 713 px column
//     "top": 52,                                  // crop the top bar (organization, project, branch) off every frame
//     "mask": ["Jane Q\\. Doe", { "pattern": "acme-[a-z]+", "with": "my-project" }],
//                                                 // added to the default KBC_… mask (→ "KEBOOLA_PROJECT"); a plain
//                                                 // string is replaced by "Keboola User" (a name in a list view)
//     "steps": [
//       { "goto": "https://connection…/storage/in.c-x/overview" },
//       { "shot": "bucket", "ring": { "role": "button", "name": "Add Table" } },
//       { "click": { "role": "button", "name": "Add Table" } },
//       { "shot": "dialog", "ring": { "text": "Upload CSV File" } },
//       { "click": { "text": "Upload CSV File" } },
//       { "upload": { "css": "[role=dialog] input[type=file]" }, "file": "/tmp/orders.csv" },
//       { "fill": { "css": "[role=dialog] input[name=tableName]" }, "value": "orders" },
//       { "shot": "form", "ring": { "role": "button", "name": "Create table", "within": "dialog" } },
//       { "click": { "role": "button", "name": "Create table", "within": "dialog" } },
//       { "wait": 8000 },
//       { "goto": "…/table/orders/overview" }, { "click": { "text": "Data Sample" } },
//       { "shot": "done" }                          // the final state has no ring
//     ]
//   }
// A target is { role, name } | { text } | { css }, optionally "within": "dialog", "in": <another target>
// (search inside its first match, e.g. one table row: every row has its own "More actions", R2) and
// "nth": n (0-based, default 0). Only visible elements match a { text } target (a hidden first match
// in a collapsed column timed out, R6).
// A ring goes around what the reader clicks: from the target the script climbs to the nearest
// clickable ancestor (button, link, menu item, option, tab, or anything with cursor: pointer), so
// { "text": "Snowflake SQL Workspace" } rings the whole card, not the title's text box (field test
// 2026-10-15: a ring on the text cut through the card's description). "exact": true keeps the
// target's own box.
// Other steps: { "press": "Escape" }, { "wait": ms }, { "hover": <target> } (the next shot keeps the
// pointer there, so a hover-revealed menu or tooltip stays open; G1), { "scroll": <target> } (scrolls
// it into view, also inside Keboola's inner scroll container; a ring target off-screen is scrolled to
// by itself, G5). A click takes "after": ms (default 1200) before the next step.
// Shot keys: "keepPointer": true (do not park the pointer), "fast": true (no settle wait, for a toast
// or another state that disappears; pair it with a short "after" on the click before it, G6),
// "keepFocus", "keepBackdrop" (below). A fast shot also keeps the pointer and the focus where they are. A top-level "crop": [x, y, w, h] in CSS px below the top bar
// overrides the automatic crop of ring-frames.py.
// Looping animations (spinners, a pulsing button) are paused before each shot, so they neither
// blur a frame nor keep the settle wait busy (G4).
// Recon: `capture-states.mjs plan.json --list` also prints, after every step and at each shot (and appends
// to <out>/list.txt; the plan still runs and writes its frames), the visible buttons, links
// (with href), tabs, menu items and fields (with their label), open tooltips, and a css hint for
// controls without a name, so targets can be written without probe code. Never curl or save a
// Keboola page for recon: its HTML holds session and CSRF tokens (G7, R7).
// Privacy: "mask" rewrites text by regex; "redact": [<target>, …] (top level) replaces the text of
// every element a target matches, e.g. { "css": "table td:nth-child(2)" } for a column of names, with
// "Keboola User" (or "with"), and hides the images inside; "hideAvatars": true hides avatar images and
// initials badges everywhere (R7: 15 unknown names, avatars in frame).
// Per shot: "hold": seconds overrides ring-frames' hold for that state (a full-screen change needs longer).
// The capture opens in its own Chrome window (fronted for each shot), so your tabs never switch.
// Before every click the pointer leaves the page, so a sidebar it hovered last time has collapsed (R4). A shot blurs the focused element first, so an
// autofocused control (a dialog's X) shows no focus outline that reads as one more ring (V8 field
// test, 2026-10-15); "keepFocus": true on the shot keeps it, for a GIF about a focused field.
// A dialog taller than the viewport (it scrolls inside, so its bottom never shows: V11, a 600 px
// Create Schedule dialog lost its Minutes and Preview) grows the viewport to fit and replays the plan
// from its first "goto", up to 1600 px; plans are read-only, so a replay is safe.
// "backdrop": 0–1 (top level, default 0.15) sets how dark that veil stays.
// A shot also lightens a modal's dark backdrop to a light veil (a dialog frame came out at luma 163
// against the 200 budget, V9), "keepBackdrop": true keeps it; and it records the shot's focus box
// (its ring, or the open dialog) in rings.json, which ring-frames.py crops every frame to.
//
// Why each detail (field test 2026-10-15): a tab opened over CDP renders at 1x and stops painting
// while the window is covered, so the script fronts the tab before every shot, turns on focus
// emulation and sets device scale 2 itself; it opens its own tab and closes it, never touching
// yours. Nothing is clicked that the plan does not name: a plan that creates something in a
// project must also clean it up (or say so to the author).
import fs from 'node:fs';
import path from 'node:path';

const planPath = process.argv[2];
if (!planPath) { console.error('usage: capture-states.mjs plan.json'); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const LIST = process.argv.includes('--list');
const PW = process.env.PLAYWRIGHT_PATH ?? path.join(process.cwd(), 'node_modules', 'playwright', 'index.mjs');
if (!fs.existsSync(PW)) { console.error(`playwright not found at ${PW}: run from a docs worktree (npm install) or set PLAYWRIGHT_PATH`); process.exit(2); }
const { chromium } = await import('file://' + PW);

const W = (plan.viewport ?? [760, 760])[0];
let H = (plan.viewport ?? [760, 760])[1];
const TOP = plan.top ?? 52;
const OUT = path.resolve(plan.out ?? 'frames');
// V12: a plan's own mask list replaced the default and a name came out as "KEBOOLA_PROJECT".
const MASK = [{ pattern: '"?KBC_[A-Z0-9_]+"?', with: '"KEBOOLA_PROJECT"' },
  ...(plan.mask ?? []).filter((m) => m !== 'KBC_[A-Z0-9_]+').map((m) => (typeof m === 'string' ? { pattern: m, with: 'Keboola User' } : m))];
fs.mkdirSync(OUT, { recursive: true });

let browser;
try { browser = await chromium.connectOverCDP(process.env.CDP_URL ?? 'http://localhost:9222'); }
catch {
  console.error('Could not connect to Chrome on port 9222. Start a debug Chrome with its own profile and log into Keboola in it:\n  open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.keboola-shots/chrome-cdp"');
  process.exit(2);
}
const ctx = browser.contexts().find((c) => c.pages().some((p) => p.url().includes('keboola.com'))) ?? browser.contexts()[0];
// Its own window: fronting a tab in the author's window made it flicker on every shot (R-round feedback).
let page;
try {
  const bcdp = await browser.newBrowserCDPSession();
  const pageP = ctx.waitForEvent('page', { timeout: 10000 });
  await bcdp.send('Target.createTarget', { url: 'about:blank', newWindow: true });
  page = await pageP;
} catch { page = await ctx.newPage(); }
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });

const loc = async (t) => {
  let scope = t.within === 'dialog' ? page.getByRole('dialog') : page;
  if (t.in) scope = await loc(t.in);
  const n = t.nth ?? 0;
  if (t.css) return scope.locator(t.css).nth(n);
  if (t.role) return scope.getByRole(t.role, t.name ? { name: t.name } : {}).nth(n);
  // An exact match wins; only without one does a card title with a badge ("DuckDB Transformation (Beta)")
  // fall back to a partial match (V12). `exact.or(partial)` took the first in page order and ringed the
  // sidebar's "Components" for "Component" (G4). Visible elements only (R6).
  if (t.text) {
    const ex = scope.getByText(t.text, { exact: true }).filter({ visible: true });
    return (await ex.count()) ? ex.nth(n) : scope.getByText(t.text).filter({ visible: true }).nth(n);
  }
  throw new Error(`bad target ${JSON.stringify(t)}`);
};
const ACT = { timeout: 10000 };   // a missing target fails in 10 s with a plain message, not 30 s and a stack (R5)
// The "Latest update" promo card: remove its position:fixed ancestor (its X only cycles the cards).
const REDACT = plan.redact ?? [];
const cleanUp = (masks) => page.evaluate(({ masks, avatars }) => {
  if (avatars) for (const el of document.querySelectorAll('img[alt*="avatar" i], img[src*="avatar" i], img[src*="gravatar" i], [class*="avatar" i], [class*="Avatar"]'))
    el.style.setProperty('visibility', 'hidden', 'important');
  for (const el of document.querySelectorAll('body *')) {
    if ((el.innerText || '').startsWith('Latest update')) {
      let n = el; while (n && getComputedStyle(n).position !== 'fixed') n = n.parentElement;
      (n ?? el).remove(); break;
    }
  }
  for (const a of document.getAnimations()) { const t = a.effect?.getComputedTiming?.(); if (t && t.iterations === Infinity) a.pause(); }
  // Text nodes, not leaf elements: a breadcrumb name next to an icon was never masked (G7).
  const res = masks.map((m) => [new RegExp(m.pattern, 'g'), m.with]);
  const hits = masks.map(() => 0);
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    let t = n.nodeValue;
    res.forEach(([r, w], i) => { t = t.replace(r, () => { hits[i]++; return w; }); });
    if (t !== n.nodeValue) n.nodeValue = t;
  }
  for (const el of document.querySelectorAll('input[value], textarea')) {
    let t = el.value; res.forEach(([r, w], i) => { t = t.replace(r, () => { hits[i]++; return w; }); });
    if (t !== el.value) el.value = t;
  }
  return hits;
}, { masks, avatars: Boolean(plan.hideAvatars) });
// "redact": the text of every element a target matches becomes "Keboola User" (or "with"); images inside hide
const locAll = async (t) => {
  const scope = t.in ? await loc(t.in) : t.within === 'dialog' ? page.getByRole('dialog') : page;
  if (t.css) return scope.locator(t.css);
  if (t.role) return scope.getByRole(t.role, t.name ? { name: t.name } : {});
  if (t.text) return scope.getByText(t.text);
  throw new Error(`bad target ${JSON.stringify(t)}`);
};
const redact = async () => {
  for (const r of REDACT) {
    const all = await locAll(r);
    const count = await all.count();
    for (let i = 0; i < count; i++) await all.nth(i).evaluate((el, w) => {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let first = true;
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { if (!n.nodeValue.trim()) continue; n.nodeValue = first ? w : ''; first = false; }
      for (const im of el.querySelectorAll('img, svg, [style*="background-image"]')) im.style.setProperty('visibility', 'hidden', 'important');
    }, r.with ?? 'Keboola User').catch(() => {});
    if (!count) console.warn(`redact ${JSON.stringify(r)} matched nothing`);
  }
};
const maskHits = MASK.map(() => 0);

// Wait until two small captures 250 ms apart are identical (animations done), at most 4 s.
const settle = async (shot, maxMs = 4000) => {
  const snap = async () => (await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: 0, y: TOP, width: W, height: H - TOP, scale: 0.25 } })).data;
  let prev = await snap();
  for (let t = 0; t < maxMs; t += 250) {
    await page.waitForTimeout(250);
    const cur = await snap();
    if (cur === prev) return true;
    prev = cur;
  }
  console.warn(`  "${shot}" still moving after 4 s (an animation or a spinner): look at this frame before using it`);
  return false;
};

const listNow = async (label) => {
  const text = `--list ${label}:\n` + await page.evaluate((top) => {
        const out = [];
        const seen = (el) => { const cs = getComputedStyle(el); let o = 1; for (let n = el; n; n = n.parentElement) o *= +getComputedStyle(n).opacity; return cs.visibility !== 'hidden' && o > 0.2; };
        const label = (el) => el.getAttribute('aria-label') || (el.labels?.[0]?.innerText) || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText) || '';
        for (const el of document.querySelectorAll('button, a[href], [role=button], [role=tab], [role=menuitem], [role=option], [role=link], [role=combobox], input, select, textarea')) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || r.bottom < top || r.top > innerHeight || !seen(el)) continue;
          const role = el.getAttribute('role') || ({ A: 'link', BUTTON: 'button', SELECT: 'combobox', TEXTAREA: 'textbox' }[el.tagName] ?? (el.tagName === 'INPUT' ? `input[${el.type}]` : el.tagName.toLowerCase()));
          const name = (label(el) || el.innerText || el.getAttribute('title') || el.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
          const hint = name ? '' : `  css: ${el.tagName.toLowerCase()}${el.dataset.testid ? `[data-testid="${el.dataset.testid}"]` : el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0].replace(/:/g, '\\:') : ''}`;
          const href = el.tagName === 'A' ? `  → ${el.getAttribute('href')}` : '';
          out.push(`    ${role.padEnd(14)} ${JSON.stringify(name)}  @${Math.round(r.x)},${Math.round(r.y - top)}${href}${hint}`);
        }
        for (const t of document.querySelectorAll('[role=tooltip]')) if (t.innerText.trim()) out.push(`    tooltip        ${JSON.stringify(t.innerText.trim().slice(0, 60))}`);
        return out.join('\n');
      }, TOP);
  console.log(text);
  fs.appendFileSync(path.join(OUT, 'list.txt'), text + '\n');
};

let rings;
class Grow { constructor(h) { this.h = h; } }
async function runPlan() {
  rings = { viewport: [W, H], top: TOP, scale: 2, order: [], rings: {}, focus: {}, cards: {}, scroll: {}, holds: {}, modal: {} };
  let hovered = null;   // the last hover target, until a click, a key or a page change
  for (const [si, step] of plan.steps.entries()) try {
    if (step.goto) { hovered = null; await page.goto(step.goto, { waitUntil: 'networkidle' }).catch(() => {}); }
    else if (step.click) {
      if (!hovered) { await page.mouse.move(-20, -20); await page.waitForTimeout(300); }   // let a hovered sidebar collapse (R4)
      const ct = await loc(step.click);
      if (!(await ct.isVisible().catch(() => false))) console.warn(`  step ${si + 1}: the click target is hidden (a control shown only on hover?): hover its row first, or pick the row with "in" (Q1)`);
      hovered = null; await ct.click(ACT); await page.waitForTimeout(step.after ?? 1200);
    }
    else if (step.hover) { await cdp.send('Page.bringToFront'); await (await loc(step.hover)).hover(ACT); hovered = step.hover; await page.waitForTimeout(step.after ?? 600); }
    else if (step.scroll) { await (await loc(step.scroll)).evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(step.after ?? 500); }
    else if (step.fill) await (await loc(step.fill)).fill(step.value ?? '', ACT);
    else if (step.upload) await (await loc(step.upload)).setInputFiles(path.resolve(path.dirname(planPath), step.file));
    else if (step.press) { hovered = null; await page.keyboard.press(step.press); await page.waitForTimeout(500); }
    else if (step.wait) await page.waitForTimeout(step.wait);
    else if (step.shot) {
      await cdp.send('Page.bringToFront');
      // fronting the tab re-reads the real mouse and drops a hover: hover again before the shot (fixture test)
      if (hovered && step.keepPointer !== false) { await (await loc(hovered)).hover(); await page.waitForTimeout(300); }
      // Park the pointer first (a hovered sidebar or row animates open), clean up, then wait until the
      // picture stops changing: a hover collapse or the promo card fading in were caught mid-animation
      // on a fixed 900 ms wait (V7 field test, 2026-10-15).
      // Park the pointer off the page: at (W-5, H-5) it sat on a list row and left a hover (V9).
      // a fast shot leaves pointer and focus alone: moving either closes a "Copied" tooltip (G6, ~0.4 s)
      if (!(step.keepPointer ?? (Boolean(hovered) || step.fast))) { await page.mouse.move(W - 5, 1); await page.mouse.move(-20, -20); }
      if (!(step.keepFocus ?? step.fast)) await page.evaluate(() => document.activeElement?.blur?.());
      if (!step.keepBackdrop) await page.evaluate((veil) => {
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.position !== 'fixed' || el.matches('[role=dialog], [role=alertdialog]')) continue;
          const r = el.getBoundingClientRect();
          if (r.width < innerWidth * 0.9 || r.height < innerHeight * 0.9) continue;
          // A veil is translucent: Keboola's is `bg-black/50`, computed as oklab(0 none none / 0.5), and it
          // wraps the dialog. Any colour format ends with its alpha; an opaque page wrapper has none.
          const a = cs.backgroundColor.match(/(?:,|\/)\s*([\d.]+)(%?)\)$/);
          const alpha = a ? +a[1] / (a[2] ? 100 : 1) : 1;
          if (alpha <= 0.05 || alpha >= 1) continue;
          // a light veil (15 % by default, "backdrop": 0–1 in the plan): fully transparent let the white
          // dialog melt into the page (human test T2); the crop no longer diffs dialog frames, so a dim
          // veil cannot widen it (R7)
          el.style.setProperty('background-color', `rgba(15, 23, 42, ${veil})`, 'important');
          el.style.setProperty('backdrop-filter', 'none', 'important');
        }
      }, plan.backdrop ?? 0.15);
      await page.waitForTimeout(step.settle ?? (step.fast ? 100 : 600));
      (await cleanUp(MASK)).forEach((h, i) => { maskHits[i] += h; }); await redact();
      if (!step.fast) await settle(step.shot);
      (await cleanUp(MASK)).forEach((h, i) => { maskHits[i] += h; }); await redact();
      // a clipped CDP screenshot (the settle check) makes Chrome drop :hover: hover again right before
      // the ring and the shot (fixture test)
      if (hovered && step.keepPointer !== false) { await (await loc(hovered)).hover(); await page.waitForTimeout(300); }
      const extra = await page.evaluate(() => {
        let x = 0;
        for (const d of document.querySelectorAll('[role=dialog], [role=alertdialog]')) {
          for (const el of [d, ...d.querySelectorAll('*')]) {
            if (/auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 2) x = Math.max(x, el.scrollHeight - el.clientHeight);
          }
          x = Math.max(x, d.getBoundingClientRect().bottom - innerHeight);
        }
        return Math.ceil(x);
      });
      if (extra > 0) {
        const want = Math.min(1600, Math.ceil(H + extra / 0.8 + 24));   // dialogs cap at ~80vh
        if (want > H && plan.steps[0]?.goto) throw new Grow(want);
        console.warn(`  "${step.shot}": a dialog still scrolls (${extra} px hidden) at height ${H}: shorten the dialog's content or split the shot`);
      }
      if (step.ring) {
        const target = await loc(step.ring);
        const bb = await target.boundingBox();
        if (bb && (bb.y < TOP || bb.y + bb.height > H)) {        // below the fold: scroll it to the middle (G5)
          await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
          await page.waitForTimeout(400);
          if (!step.fast) await settle(step.shot);
        }
        const b = step.ring.exact ? await target.boundingBox() : await target.evaluate((el) => {
          const clickable = (n) => n.matches('button, a[href], [role=button], [role=menuitem], [role=option], [role=tab], [role=radio], [role=combobox], input, select, textarea, label, summary')
            || getComputedStyle(n).cursor === 'pointer';
          let n = el;
          while (n && n !== document.body && !clickable(n)) n = n.parentElement;
          // a pointer cursor is inherited: take the outermost ancestor that still has it, up to a real control
          if (n && n !== document.body && !n.matches('button, a[href], [role=button], [role=menuitem], [role=option], [role=tab]'))
            while (n.parentElement && n.parentElement !== document.body && getComputedStyle(n.parentElement).cursor === 'pointer'
              && !n.parentElement.matches('[role=dialog], [role=menu], [role=listbox]')) n = n.parentElement;
          let ctl = n && n !== document.body ? n : el;
          // a field: ring the box drawn around the input (its border and chevron), not the bare input (Q4)
          if (ctl.matches('input, select, textarea, [role=combobox]')) {
            const ir = ctl.getBoundingClientRect();
            for (let p = ctl.parentElement, i = 0; p && i < 4; p = p.parentElement, i++) {
              const pr = p.getBoundingClientRect(), cs = getComputedStyle(p);
              if (pr.height > ir.height * 2.2 || pr.width < ir.width - 1) break;
              if (parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none' || cs.backgroundColor !== getComputedStyle(p.parentElement ?? p).backgroundColor) { ctl = p; break; }
            }
          }
          const r = ctl.getBoundingClientRect();
          // the card or row around the control, so the crop keeps whole neighbouring text (R3, R6)
          let c = ctl.parentElement, card = null;
          while (c && c !== document.body) {
            const cs = getComputedStyle(c), cr = c.getBoundingClientRect();
            if (cr.height > innerHeight * 0.4 || (cr.width > innerWidth * 0.9 && cr.height > innerHeight * 0.3)) break;   // a whole table is no card (Q1)
            if (cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0 || c.matches('tr, li, [role=row], [role=listitem], section, fieldset')) { card = cr; break; }
            c = c.parentElement;
          }
          return { x: r.x, y: r.y, width: r.width, height: r.height, clickable: Boolean(n && n !== document.body),
            card: card && { x: card.x, y: card.y, w: card.width, h: card.height } };
        });
        if (!b) throw new Error(`ring target not visible for "${step.shot}": ${JSON.stringify(step.ring)}`);
        rings.rings[step.shot] = { x: b.x, y: b.y - TOP, w: b.width, h: b.height };
        if (b.card) rings.cards[step.shot] = { x: b.card.x, y: b.card.y - TOP, w: b.card.w, h: b.card.h };
        // role/name and text matching ignore case: say when the label on screen differs from the plan (R3)
        const want = step.ring.name ?? step.ring.text;
        if (want) {
          const shown = (await target.evaluate((el) => el.getAttribute('aria-label') || el.innerText || '')).trim().replace(/\s+/g, ' ');
          if (shown && !shown.includes(want) && shown.toLowerCase().includes(want.toLowerCase()))
            console.warn(`  "${step.shot}": the label on screen is "${shown}", the plan says "${want}": update the page text to the screen's casing`);
        }
        if (b.clickable === false) console.warn(`  "${step.shot}": the ring target is not a control (no button, link or pointer cursor around it): ring what the reader clicks (R5)`);
        if (b.y < TOP || b.y + b.height > H || b.x < 0 || b.x + b.width > W || !b.width)
          console.warn(`  "${step.shot}": the ring target is outside the frame or has no size (${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}): pick a visible target`);
        const op = await target.evaluate((el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; });
        if (op < 0.2) console.warn(`  "${step.shot}": the ring target is transparent (opacity ${op.toFixed(2)}): it shows only on hover? add a { "hover": … } step first`);
      }
      const dlg = await page.evaluate(() => {
        // the dialog and everything drawn from it (a badge that sticks out above it, V11), within the viewport
        const d = [...document.querySelectorAll('[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [role=tooltip], [data-radix-popper-content-wrapper]')].flatMap((e) => [e, ...e.querySelectorAll('*')])
          .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight);
        return d.length ? { x: Math.min(...d.map((r) => r.x)), y: Math.min(...d.map((r) => r.y)), r: Math.max(...d.map((r) => r.right)), b: Math.max(...d.map((r) => r.bottom)) } : null;
      });
      rings.modal[step.shot] = await page.evaluate(() => [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].some((d) => d.getBoundingClientRect().width > 0));
      if (dlg && dlg.y < TOP) console.warn(`  "${step.shot}": an open menu or popover reaches above the top crop (y=${Math.round(dlg.y)} < ${TOP}): it opens upward; lower "top" or scroll the control down first (R5)`);
      rings.scroll[step.shot] = await page.evaluate(() => {
        let s = Math.round(scrollY);
        for (const el of document.querySelectorAll('body *')) if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight + 4) s += Math.round(el.scrollTop);
        return s;
      });
      if (step.hold) rings.holds[step.shot] = step.hold;
      const parts = [rings.rings[step.shot], dlg && { x: dlg.x, y: dlg.y - TOP, w: dlg.r - dlg.x, h: dlg.b - dlg.y }].filter(Boolean);
      if (parts.length) {
        const x = Math.min(...parts.map((q) => q.x)), y = Math.min(...parts.map((q) => q.y));
        rings.focus[step.shot] = { x, y, w: Math.max(...parts.map((q) => q.x + q.w)) - x, h: Math.max(...parts.map((q) => q.y + q.h)) - y };
      }
      if (LIST) await listNow(`"${step.shot}"`);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: 0, y: TOP, width: W, height: H - TOP, scale: 1 } });
      fs.writeFileSync(path.join(OUT, `${step.shot}.png`), Buffer.from(data, 'base64'));
      rings.order.push(step.shot);
      console.log(`shot ${step.shot}${step.ring ? ' (ring)' : ''}`);
    }
    if (LIST && !step.shot) await listNow(`after step ${si + 1} ${Object.keys(step)[0]}`);   // recon in one run (Q1 needed four)
  } catch (e) {
    if (e instanceof Grow) throw e;
    throw new Error(`step ${si + 1} ${JSON.stringify(step)}: ${String(e.message).split('\n')[0]}\n  run with --list to see the controls on screen at the shot before it`);
  }
}
try {
  for (let attempt = 0; ; attempt++) {
    try { await runPlan(); break; }
    catch (e) {
      if (!(e instanceof Grow) || attempt >= 3) throw e;
      console.log(`a dialog is taller than the viewport: replaying the plan at ${W}x${e.h}`);
      H = e.h;
      // a goto to the same URL with a #hash only scrolls the old document, dialog still open: start clean
      await page.goto('about:blank').catch(() => {});
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });
    }
  }
  if (plan.crop) rings.crop = plan.crop;
  MASK.forEach((m, i) => { if (i && !maskHits[i]) console.warn(`mask ${JSON.stringify(m.pattern)} matched nothing: check its spelling against the screen (a silent mask is how names leak, G7)`); });
  if (TOP < 52) console.warn(`top is ${TOP}: the top bar with the organization and project names is in the frame; mask both names`);
  fs.writeFileSync(path.join(OUT, 'rings.json'), JSON.stringify(rings, null, 1));
  console.log(`${rings.order.length} frames + rings.json in ${OUT}`);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
} finally {
  await page.close().catch(() => {});
  await browser.close();                         // disconnects CDP only; your Chrome stays open
}
