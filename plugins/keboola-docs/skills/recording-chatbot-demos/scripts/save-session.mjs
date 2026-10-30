// save-session.mjs <config.json>: a headed login window for the chat app. The person types the
// credentials; this script types nothing. It saves the session (storageState) as soon as the URL
// leaves the login page and the chat composer shows, then closes. Never click "Switch account" or "Sign out" in that window:
// both revoke the saved session on the server, even though the cookie still looks valid.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PW = process.env.PLAYWRIGHT_PATH ?? path.join(process.cwd(), 'node_modules', 'playwright', 'index.mjs');
if (!fs.existsSync(PW)) { console.error(`playwright not found at ${PW}: run from a checkout with node_modules or set PLAYWRIGHT_PATH`); process.exit(2); }
const { chromium } = await import('file://' + PW);
const C = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const STATE = C.state.replace(/^~/, os.homedir());
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: null });
const page = await ctx.newPage();
await page.goto(C.app + C.loginPath);
console.log('Log in in the opened window (SSO and MFA steps included), then open the chat if the app does not; it closes by itself.');
const deadline = Date.now() + 90 * 60 * 1000;
let ok = false;
while (Date.now() < deadline && !ok) {
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const u = new URL(page.url());
    ok = u.origin === new URL(C.app).origin && !u.pathname.startsWith(C.loginPath) && !/auth|signin|password|mfa|otp/i.test(u.pathname)
      && await page.locator(C.composer).first().isVisible();
  } catch {}
}
if (!ok) { console.error('timed out'); await browser.close(); process.exit(1); }
await new Promise((r) => setTimeout(r, 3000));
fs.mkdirSync(path.dirname(STATE), { recursive: true });
await ctx.storageState({ path: STATE });
await browser.close();
console.log('saved', STATE);
