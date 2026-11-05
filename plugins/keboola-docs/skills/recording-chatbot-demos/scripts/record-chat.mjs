// record-chat.mjs: record a chat assistant answering prompts, at 2x, through the CDP screencast.
//
//   node record-chat.mjs --config app.json --prompts prompts.json --out <take-dir> [--from N] [--only N] [--session URL]
//   ... --dry       checks the session, selectors and sidebar filter, types prompt N without sending it,
//                   records ~5 s and clears the field: costs nothing. Run it before every real run.
//   ... --extract --session URL   records nothing: reads the answers of an existing chat into answers.json
//
// prompts.json: an array of strings, or of {"prompt": "...", "expect": ["regex", ...]}; check-clip.py
// tests every answer (answers.json, written after each prompt) against its expect patterns.
//
// Without --from/--only it opens a NEW chat and asks every prompt in that one chat. --from N --only N
// records prompt N alone (in a new chat unless --session points at an existing one). Then
// `python3 build-raw.py <take-dir>` and `python3 edit-clip.py <take-dir> <out.mp4>`.
// Config (examples/kaide.json):
//   app           origin, e.g. "https://kaide.agnes-fleet.keboola.systems"
//   chatPath      path that opens a NEW chat ("/chat"); loginPath  path of the login page ("/login")
//   state         where save-session.mjs keeps the session (storageState; sessionStorage-only apps need more)
//   composer      selector of the prompt field;   send  selector of the Send button
//   chatLink      selector of a chat-list link (only the current chat stays listed; "" leaves the list alone)
//   sessionParam  query parameter holding the chat id, if any ("session"); otherwise the link's URL is compared
//   busyLabel     regex on button labels shown while the assistant works ("stop|cancel generat")
//   viewport      [1280, 800] css px; recorded at 2x
//   zoomOn        optional selector of the detail edit-clip.py --zoom detail eases in on after each answer
//                 (its last visible match, e.g. the Sources row ".msg-sources")
//
// What it does per prompt: the pointer clicks the composer, types the prompt at a human rate, clicks
// Send, waits until the busy control is gone and the page text has not changed for 8 s (cap 6 min),
// brings the question to the top of the message column, pauses, scrolls down to the end of the answer
// at ~110 css px/s, holds 2.5 s. Every step is a mark in marks.json, which the editor reads.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const PW = process.env.PLAYWRIGHT_PATH ?? path.join(process.cwd(), 'node_modules', 'playwright', 'index.mjs');
if (!fs.existsSync(PW)) { console.error(`playwright not found at ${PW}: run from a checkout with node_modules or set PLAYWRIGHT_PATH`); process.exit(2); }
const { chromium } = await import('file://' + PW);

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const C = JSON.parse(fs.readFileSync(arg('config'), 'utf8'));
const PROMPTS = JSON.parse(fs.readFileSync(arg('prompts'), 'utf8')).map((x) => (typeof x === 'string' ? x : x.prompt));
const DRY = process.argv.includes('--dry'), EXTRACT = process.argv.includes('--extract');
const OUT = path.resolve(arg('out'));
const FROM = +arg('from', 1);
const ONLY = +arg('only', PROMPTS.length);
const STATE = C.state.replace(/^~/, os.homedir());
const [W, H] = C.viewport ?? [1280, 800];
const BUSY = new RegExp(C.busyLabel ?? 'stop|cancel generat', 'i').source;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const marks = [];
const frames = [];
let t0 = Date.now();
const save = () => fs.writeFileSync(OUT + '/marks.json', JSON.stringify({ frames, marks }, null, 1));
const mark = (name, extra) => { const t = (Date.now() - t0) / 1000; marks.push([name, +t.toFixed(2), extra ?? null]); console.log(name, t.toFixed(2), extra ? JSON.stringify(extra) : ''); save(); };

// A hollow-ring pointer with a ripple on click (the real cursor is hidden). The chat list keeps only
// the chat being recorded: other people's runs stay out of the frame, the current chat stays in it.
const INIT = `
(() => {
  const LINK = ${JSON.stringify(C.chatLink ?? '')}, PARAM = ${JSON.stringify(C.sessionParam ?? 'session')};
  const css = document.createElement('style');
  css.textContent = '#rec-cursor{position:fixed;z-index:2147483647;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid rgba(31,143,235,.95);background:rgba(31,143,235,.08);box-shadow:0 0 0 2px rgba(255,255,255,.9);pointer-events:none;left:-60px;top:-60px}' +
    '.rec-ripple{position:fixed;z-index:2147483646;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid rgba(31,143,235,.95);pointer-events:none;animation:recr .6s ease-out 1 forwards}' +
    '@keyframes recr{from{opacity:.95;transform:scale(.5)}to{opacity:0;transform:scale(2.6)}}*{cursor:none!important}';
  const start = () => {
    document.head.appendChild(css);
    const c = document.createElement('div'); c.id = 'rec-cursor'; document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', (e) => { const r = document.createElement('div'); r.className = 'rec-ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 800); }, true);
    if (!LINK) return;
    const only = () => {
      const sid = new URLSearchParams(location.search).get(PARAM);
      for (const a of document.querySelectorAll(LINK)) {
        const u = new URL(a.href, location.href);
        const mine = (sid && a.href.includes(sid)) || (u.pathname + u.search === location.pathname + location.search && location.pathname !== ${JSON.stringify(C.chatPath)});
        const li = a.closest('li') || a; const want = mine ? '' : 'none';
        if (li.style.display !== want) li.style.display = want;
      }
    };
    only(); new MutationObserver(only).observe(document.body, { subtree: true, childList: true }); setInterval(only, 250);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start();
})();
`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT + '/frames', { recursive: true });
const b = await chromium.launch({ headless: true, args: ['--force-device-scale-factor=2'] });
const ctx = await b.newContext({ storageState: STATE, viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await ctx.addInitScript(INIT);
const p = await ctx.newPage();
await p.goto(arg('session', C.app + C.chatPath), { waitUntil: 'networkidle', timeout: 60000 });
if (new URL(p.url()).pathname.startsWith(C.loginPath)) { console.error('session expired or revoked: run save-session.mjs again'); await b.close(); process.exit(3); }
await sleep(2500);
const field = p.locator(C.composer);
await field.waitFor({ state: 'visible', timeout: 30000 });

const box = async (loc) => { const r = await loc.boundingBox(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; };
// the message column: the largest scrollable element
const scroller = `(() => { let best = null; for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 300) { if (!best || e.clientHeight * e.clientWidth > best.clientHeight * best.clientWidth) best = e; } } return best; })()`;
const textLen = () => p.evaluate(() => (document.querySelector('main') || document.body).innerText.length);
const busy = () => p.evaluate((re) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return [...document.querySelectorAll('button, [role=button]')].some((e) => vis(e) && new RegExp(re, 'i').test((e.getAttribute('aria-label') || '') + ' ' + (e.innerText || '').trim()))
    || [...document.querySelectorAll('[aria-busy="true"]')].some(vis);
}, BUSY);
const scrollBy = (dy, ms) => p.evaluate(([sel, dy, ms]) => new Promise((res) => {
  const el = eval(sel); if (!el) return res(0);
  const y0 = el.scrollTop, y1 = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, y0 + dy)); const s = performance.now();
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const f = (now) => { const k = Math.min(1, (now - s) / ms); el.scrollTop = y0 + (y1 - y0) * ease(k); if (k < 1) requestAnimationFrame(f); else res(y1 - y0); };
  requestAnimationFrame(f);
}), [scroller, dy, ms]);
const scrollInfo = () => p.evaluate((sel) => { const el = eval(sel); return el && { top: el.scrollTop, h: el.scrollHeight, ch: el.clientHeight }; }, scroller);
// where the newest copy of the prompt sits below the top of the message column (css px)
const promptOffset = (text) => p.evaluate(([sel, text]) => {
  const el = eval(sel); if (!el) return null;
  const hits = [...el.querySelectorAll('*')].filter((e) => e.children.length < 4 && (e.innerText || '').trim() === text);
  const h = hits[hits.length - 1];
  return h ? h.getBoundingClientRect().top - el.getBoundingClientRect().top : null;
}, [scroller, text]);

// the text of each prompt's answer: what the page shows between that prompt and the next one
const answerTexts = () => p.evaluate((prompts) => {
  const main = (document.querySelector('main') || document.body).innerText;
  const out = {}; let from = 0;
  prompts.forEach((q, i) => {
    const at = main.indexOf(q, from); if (at < 0) return;
    const nextQ = prompts.slice(i + 1).map((x) => main.indexOf(x, at + q.length)).filter((x) => x > 0);
    const end = nextQ.length ? Math.min(...nextQ) : main.length;
    out[i + 1] = main.slice(at + q.length, end).trim(); from = at + q.length;
  });
  return out;
}, PROMPTS);
const saveAnswers = async () => { const a = await answerTexts(); fs.writeFileSync(OUT + '/answers.json', JSON.stringify(a, null, 1)); return a; };
if (EXTRACT) {
  await sleep(2000);
  const a = await saveAnswers();
  console.log('answers', Object.keys(a).length, 'of', PROMPTS.length, '->', OUT + '/answers.json');
  await ctx.close(); await b.close(); process.exit(0);
}
if (DRY) {
  const links = C.chatLink ? await p.locator(C.chatLink).count() : 0;
  const shown = C.chatLink ? await p.locator(C.chatLink).evaluateAll((as) => as.filter((a) => (a.closest('li') || a).style.display !== 'none').length) : 0;
  const checks = {
    url: p.url(),
    composer: await field.isVisible(),
    send: (await p.locator(C.send).count()) > 0,
    chatLinks: links, chatLinksShown: shown,        // a new chat: none shown; an existing --session: 1
    scroller: await p.evaluate((sel) => !!eval(sel), scroller),
  };
  console.log('dry checks', JSON.stringify(checks));
}

const cdp = await ctx.newCDPSession(p);
t0 = Date.now();
cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
  const t = (Date.now() - t0) / 1000; const f = `f${String(frames.length).padStart(6, '0')}.jpg`;
  fs.writeFileSync(`${OUT}/frames/${f}`, Buffer.from(data, 'base64')); frames.push([f, +t.toFixed(3)]);
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch {}
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });
await p.mouse.move(W - 65, H - 160);
// a 1-px repaint every 100 ms keeps frames coming while the screen is still
await p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;z-index:2147483647;pointer-events:none'; document.body.appendChild(d); let k = 0; setInterval(() => { d.style.background = (k++ % 2) ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)'; }, 100); });
await sleep(2000);
mark('start', { url: p.url() });

try {
  for (let n = FROM; n <= Math.min(ONLY, PROMPTS.length); n++) {
    const prompt = PROMPTS[n - 1];
    if (DRY) {
      const fb = await box(field);
      await p.mouse.move(fb.x + 60, fb.y + fb.h / 2, { steps: 28 }); await p.mouse.down(); await p.mouse.up();
      await field.focus(); await p.keyboard.type(prompt.slice(0, 80), { delay: 20 });
      mark(`dry-typed`, { send: await box(p.locator(C.send).first()) });
      await sleep(1500); await field.fill(''); mark('dry-cleared');
      break;
    }
    const fb = await box(field);
    mark(`q${n}-field`, fb);
    await p.mouse.move(fb.x + 60, fb.y + fb.h / 2, { steps: 28 }); await sleep(450);
    await p.mouse.down(); await sleep(90); await p.mouse.up(); mark(`q${n}-click`);
    await sleep(400);
    // rest the pointer in blank space right of the column, not on suggestions (hover highlights them)
    await p.mouse.move(W - 65, fb.y - 90, { steps: 14 });
    await sleep(300);
    await field.focus();
    mark(`q${n}-type`);
    await p.keyboard.type(prompt, { delay: 38 });
    mark(`q${n}-typed`);
    await sleep(900);
    const sb = await box(p.locator(C.send).first());
    mark(`q${n}-send-box`, sb);
    await p.mouse.move(sb.x + sb.w / 2, sb.y + sb.h / 2, { steps: 16 }); await sleep(350);
    await p.mouse.down(); await sleep(90); await p.mouse.up(); mark(`q${n}-send`);
    await sleep(300);
    await p.mouse.move(W - 45, H * 0.65, { steps: 18 });
    const len0 = await textLen();
    let first = false, last = len0, stable = 0, seenBusy = false;
    const t1 = Date.now();
    while (Date.now() - t1 < 6 * 60 * 1000) {
      await sleep(500);
      const len = await textLen(); const bz = await busy();
      if (bz) seenBusy = true;
      // "first" = the answer text starts (status lines like "Thinking…" add less than 250 chars)
      if (!first && len - len0 > 250) { first = true; mark(`q${n}-first`); }
      stable = len === last && !bz ? stable + 1 : 0; last = len;
      // 8 s without a change after the answer (or after a short one, once the busy control is gone);
      // the editor cuts these 8 s back out
      if ((first || (seenBusy && len > len0)) && stable >= 16) break;
    }
    mark(`q${n}-done`, { chars: last - len0, waited: Math.round((Date.now() - t1) / 1000) });
    const ans = await saveAnswers();
    if (!ans[n]) mark(`q${n}-WARN-answer-text-not-found`);
    await sleep(1200);
    // read the answer top to bottom: the question to the top (whether the chat followed the answer or not)
    const off = await promptOffset(prompt);
    mark(`q${n}-scroll-info`, { off, si: await scrollInfo() });
    if (off === null) mark(`q${n}-WARN-prompt-not-found`, { hint: 'the app renders the prompt differently: the answer was not scrolled through' });
    if (off !== null) {
      mark(`q${n}-up`); if (Math.abs(off - 24) > 20) { await scrollBy(off - 24, 1600); await sleep(1600); }
      await sleep(800);
      const si = await scrollInfo();
      const down = si.h - si.ch - si.top;
      mark(`q${n}-down`, { px: down });
      if (down > 0) await scrollBy(down, Math.max(2500, down * 9));
      mark(`q${n}-read`);
    }
    if (C.zoomOn) {
      const r = await p.locator(C.zoomOn).evaluateAll((els) => {
        const vis = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.bottom > 0 && r.top < innerHeight);
        const r = vis[vis.length - 1]; return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
      });
      mark(r ? `q${n}-detail` : `q${n}-WARN-detail-not-found`, r);
    }
    await sleep(2500);
    mark(`q${n}-end`, { url: p.url() });
  }
} catch (e) {
  mark('error', { message: String((e && e.message) || e).slice(0, 300), url: p.url() });
}
await sleep(1500);
await cdp.send('Page.stopScreencast');
mark('stop', { url: p.url() });
await ctx.close(); await b.close();
console.log('frames', frames.length);
