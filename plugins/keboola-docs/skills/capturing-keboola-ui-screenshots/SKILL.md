---
name: capturing-keboola-ui-screenshots
description: "Use when shooting a Keboola UI screenshot for a help.keboola.com page (Apps, Kai chat, Storage, Flows, deploy wizard): the capture rules (2x, 1100 px, no names, toast, CSP, Kai panel) and the CDP helper. Stale shots on an existing page start in docs-update, which calls this. Triggers: \"сними скриншот\", \"screenshot for the page\"."
---

# Capturing Keboola UI screenshots for the Apps docs


## Working Directory Context

Run `scripts/shoot-cdp.mjs` from the root of a connection-docs worktree (it writes to `public/` there), or pass `--root <worktree>` / set `KEBOOLA_DOCS_ROOT`. The script finds its own location; never `cd` into the skill directory.

## Overview

The Apps docs reach the real product UI behind your Keboola login. Capture it by
connecting Playwright to your **already-open, logged-in Chrome over CDP** — no
re-login, no session file to hand over. PNGs are written straight into
`public/<section>/`, where the docs reference them by absolute path
(`/<section>/<name>.png`). Tool: `${CLAUDE_PLUGIN_ROOT}/skills/capturing-keboola-ui-screenshots/scripts/shoot-cdp.mjs`, a small CDP helper shipped with this
skill; run it from the root of a docs worktree so Playwright and `public/` resolve. Read `references/keboola-ui-capture.md` first: viewport and scale, what
must never be in frame, and the UI quirks that cost reshoots.

## Prerequisites

1. **A debug Chrome with its own profile** (Chrome 136+ refuses `--remote-debugging-port` on the
   default profile, so a separate `--user-data-dir` is required; `-n` opens it next to your
   normal Chrome):
   ```bash
   open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.keboola-shots/chrome-cdp"
   ```
   Log into Keboola once in that window; the profile keeps the session. Verify:
   `curl -s localhost:9222/json/version`.
2. **Playwright** installed (already in the repo).
3. **Work in a development branch** in the project so nothing touches production.

## Two capture modes

**Static screens — navigate + shoot** (no interaction):
```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/capturing-keboola-ui-screenshots/scripts/shoot-cdp.mjs"
node "$S" "<keboola-url>" <section/outname.png> [waitMs] [full]
node "$S" current <section/outname.png>   # shoot the tab you already drove to
```
A bare `outname.png` lands in `public/data-apps/`; `CDP_URL` overrides the port. Outside a docs
worktree pass `--root <worktree>` (or set `KEBOOLA_DOCS_ROOT`).

**Interactive flows — a throwaway CDP driver** (click/fill to reach a state).
Write it in the session scratchpad and import Playwright from the worktree
(`file://<worktree>/node_modules/playwright/index.mjs`); output temp shots to the scratchpad too, never
into the repo; delete the driver after. Reusable core:
```js
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = await browser.contexts()[0].newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
// Kill the "Latest update" promo toast that clutters shots:
await page.evaluate(() => {
  for (const el of document.querySelectorAll('body *')) {
    const t = el.textContent || '';
    if (t.trim().startsWith('Latest update') && t.length < 400) {
      let n = el; for (let i = 0; i < 6 && n.parentElement; i++) {
        const r = n.getBoundingClientRect();
        if (r.width < 640 && r.height < 360 && r.left < 700) { n.style.display = 'none'; break; }
        n = n.parentElement; } } }
});
// The page scrolls inside #scroll-container, not window — let Playwright scroll:
await page.getByRole('button', { name: /create streamlit app/i }).scrollIntoViewIfNeeded();
await page.screenshot({ path: 'shots/foo.png' });          // viewport
await page.getByText('or create manually').screenshot(...) // tight element crop
await browser.close(); // disconnects CDP only; leaves your Chrome open
```

## Place & verify

1. View each temp shot; keep the best, `cp` it to `public/data-apps/<name>.png`
   matching the doc's `![alt](/data-apps/<name>.png)` reference.
2. Reference/rename in the Markdown; delete any stale image it replaces (grep the
   old name first — must be unreferenced).
3. `npm run build` clean, then `node scripts/audit-phase2.mjs` → **MISSING IMAGES: 0**.
4. Delete the scratch driver and its temp shots.

## Safety — confirm side effects first

Navigation and screenshots are free. **Creating an app, Deploy/Redeploy, Approve,
Delete, or any irreversible control needs explicit per-action confirmation** — even
under a broad "go ahead." Create only in a dev branch, capture, and report every
draft you leave (name + App ID) so the owner can clean up. Never enter credentials.

## Ground the prose, not just the image

Screens you capture are directly observed product behavior — use them to replace
`VERIFY`/`TODO` guesses with accurate steps and labels. Keep a light `VERIFY` only
for things you *didn't* open (e.g. a link's destination, other stacks/versions).

## Common mistakes

| Symptom | Fix |
|---|---|
| `Could not connect to Chrome on :9222` | Chrome wasn't fully quit before relaunch; the `--args` flag is ignored otherwise. |
| Shot is at page top, target below fold | Window scroll doesn't move `#scroll-container`; use `locator.scrollIntoViewIfNeeded()`. |
| Promo "Latest update" toast in frame | Remove it via the `evaluate` helper before shooting. |
| Modal captured mid-transition (ghosted) | Add `waitForTimeout(600–900)` after the click before the shot. |
| Whole tall page needed | Pass `full` to `shoot-cdp.mjs`; otherwise it shoots the viewport. |
