#!/usr/bin/env node
// before-after.mjs: a visual before/after report for the docs pages a branch changes.
//
// WHY: checking a docs PR by hand means opening every changed page twice and hunting for the
// edits. This renders each changed page on the live site (before) and in the local build (after),
// matches their content blocks, screenshots only the blocks that differ, and writes one
// self-contained HTML file that the Artifact tool publishes as a page.
//
// Usage (from a connection-docs worktree, after `npm run build`):
//   node before-after.mjs [--root <worktree>] [--base keboola/main] [--before https://help.keboola.com]
//                         [--pages <file.md>,…] [--out <dir>] [--title "<name>"] [--preview <url base>]
//                         [--scale 1.5] [--quality 72] [--build]
// Output: <out>/before-after.html (default out: $TMPDIR/before-after-<branch>), path printed last.
//
// Matching: blocks are the children of .sl-markdown-content (list items one by one, tables whole)
// plus the H1. Equal text = unchanged. A change whose words differ only in case or punctuation is
// "cosmetic": listed with its text diff, no screenshot, to keep the page small.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes(`--${name}`);
if (flag('help')) { console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').slice(1, 17).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }

const ROOT = path.resolve(opt('root', process.cwd()));
const BASE = opt('base', 'keboola/main');
const BEFORE = (opt('before', 'https://help.keboola.com')).replace(/\/$/, '');
const PREVIEW = opt('preview', '')?.replace(/\/$/, '');
const SCALE = Number(opt('scale', '1.5'));
const QUALITY = Number(opt('quality', '72'));
const MAX_CLIP_H = 1800;
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();

const req = createRequire(path.join(ROOT, 'package.json'));
let chromium, diffWordsWithSpace;
try { ({ chromium } = req('playwright')); ({ diffWordsWithSpace } = req('diff')); }
catch (e) { console.error(`playwright and diff must resolve from ${ROOT}/node_modules (run npm install there): ${e.message}`); process.exit(2); }

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const head = git('rev-parse', '--short', 'HEAD');
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), `before-after-${branch.replace(/[^\w.-]+/g, '-')}`)));
const TITLE = opt('title', `${branch} review`);

// ---- 1. pages -------------------------------------------------------------------------------
const pageFiles = opt('pages')
  ? opt('pages').split(',').map(s => s.trim()).filter(Boolean)
  : git('diff', '--name-status', `${BASE}...HEAD`, '--', 'src/content/docs').split('\n').filter(Boolean)
      .map(l => l.split('\t')).filter(([, f]) => /\.mdx?$/.test(f) && !f.includes('/dist/'))
      .map(([st, f, f2]) => (st.startsWith('R') ? f2 : f));
if (!pageFiles.length) { console.error(`no changed pages under src/content/docs since ${BASE}`); process.exit(1); }

const slugOf = (text) => {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const m = fm && fm[1].match(/^slug:\s*['"]?([^'"\r\n]*)['"]?\s*$/m);
  return m ? m[1].replace(/^\/|\/$/g, '') : null;
};
const pages = pageFiles.map(f => {
  const abs = path.join(ROOT, f);
  const exists = fs.existsSync(abs);
  const text = exists ? fs.readFileSync(abs, 'utf8') : git('show', `${BASE}:${f}`);
  const slug = slugOf(text) ?? f.replace(/^src\/content\/docs\//, '').replace(/(\/index)?\.mdx?$/, '');
  const title = (text.match(/^title:\s*['"]?(.+?)['"]?\s*$/m) || [, slug])[1];
  return { file: f, slug, title, deleted: !exists };
});

// ---- 2. build + serve dist ------------------------------------------------------------------
const DIST = path.join(ROOT, 'dist');
const newest = Math.max(...pages.filter(p => !p.deleted).map(p => fs.statSync(path.join(ROOT, p.file)).mtimeMs), 0);
const distOk = pages.filter(p => !p.deleted).every(p => {
  const h = path.join(DIST, p.slug, 'index.html');
  return fs.existsSync(h) && fs.statSync(h).mtimeMs >= newest;
});
if (!distOk) {
  if (!flag('build')) { console.error('dist/ is missing or older than the changed pages: run `npm run build` first, or pass --build'); process.exit(2); }
  console.error('building…');
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
}
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };
const server = http.createServer((rq, rs) => {
  let p = decodeURIComponent(new URL(rq.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (f !== DIST && !f.startsWith(DIST + path.sep)) { rs.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { rs.writeHead(404).end(); return; }
  rs.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(rs);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const AFTER = `http://127.0.0.1:${server.address().port}`;

// ---- 3. render + extract blocks -------------------------------------------------------------
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: SCALE, reducedMotion: 'reduce' });

async function open(url) {
  const page = await ctx.newPage();
  const res = await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(e => ({ status: () => 0, err: e }));
  if (!res || res.status() >= 400 || res.status() === 0) { await page.close(); return null; }
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
    for (let y = 0; y < document.body.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); })));
    await document.fonts.ready;
  });
  return page;
}

const extract = (page) => page.evaluate(() => {
  const out = [];
  const push = (el) => {
    const r = el.getBoundingClientRect();
    if (r.height < 1 || r.width < 1) return;
    const imgs = [...(el.tagName === 'IMG' ? [el] : el.querySelectorAll('img'))].map(i => (i.getAttribute('src') || '').split('/').pop());
    const heading = /^H[1-6]$/.test(el.tagName) || el.classList.contains('sl-heading-wrapper');
    // Starlight's heading wrapper also holds an anchor link whose hidden label reads "Section titled …"
    const textEl = el.classList.contains('sl-heading-wrapper') ? (el.querySelector('h1,h2,h3,h4,h5,h6') || el) : el;
    const text = (textEl.innerText || '').replace(/\s+/g, ' ').trim();
    out.push({ tag: el.tagName.toLowerCase(), heading, text, imgs, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height });
  };
  const h1 = document.querySelector('main h1');
  if (h1) push(h1);
  const root = document.querySelector('.sl-markdown-content');
  if (root) for (const c of root.children) {
    if (c.tagName === 'UL' || c.tagName === 'OL') { for (const li of c.children) push(li); }
    else push(c);
  }
  return out;
});

// LCS on block keys -> opcodes like difflib
function opcodes(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  const pushOp = (t, i1, i2, j1, j2) => {
    const last = ops[ops.length - 1];
    if (last && last.t !== 'equal' && t !== 'equal') { last.i2 = i2; last.j2 = j2; last.t = 'replace'; return; }
    if (last && last.t === t && t === 'equal') { last.i2 = i2; last.j2 = j2; return; }
    ops.push({ t, i1, i2, j1, j2 });
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { pushOp('equal', i, i + 1, j, j + 1); i++; j++; }
    else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) { pushOp('insert', i, i, j, j + 1); j++; }
    else { pushOp('delete', i, i + 1, j, j); i++; }
  }
  return ops;
}

const key = (b) => `${b.text}|${b.imgs.join(',')}`;
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function shot(page, blocks) {
  if (!blocks.length) return null;
  const x1 = Math.max(0, Math.min(...blocks.map(b => b.x)) - 10);
  const x2 = Math.max(...blocks.map(b => b.x + b.w)) + 10;
  const y1 = Math.max(0, Math.min(...blocks.map(b => b.y)) - 10);
  const y2 = Math.max(...blocks.map(b => b.y + b.h)) + 10;
  const h = Math.min(y2 - y1, MAX_CLIP_H);
  const buf = await page.screenshot({ clip: { x: x1, y: y1, width: x2 - x1, height: h }, fullPage: true, type: 'jpeg', quality: QUALITY });
  return { src: `data:image/jpeg;base64,${buf.toString('base64')}`, cut: y2 - y1 > MAX_CLIP_H, bytes: buf.length };
}

const textDiff = (a, b) => diffWordsWithSpace(a, b).map(p =>
  p.added ? `<ins>${esc(p.value)}</ins>` : p.removed ? `<del>${esc(p.value)}</del>` : esc(p.value)).join('');

const results = [];
let imgBytes = 0;
for (const p of pages) {
  const url = `/${p.slug}/`;
  process.stderr.write(`${p.slug} … `);
  const bp = await open(BEFORE + url);
  const ap = p.deleted ? null : await open(AFTER + url);
  const r = { ...p, url, status: !bp && ap ? 'new' : bp && !ap ? 'gone' : !bp && !ap ? 'missing' : 'changed', visual: [], cosmetic: [] };
  if (r.status === 'changed') {
    const A = await extract(bp), B = await extract(ap);
    const ops = opcodes(A.map(key), B.map(key));
    for (const o of ops) {
      if (o.t === 'equal') continue;
      const before = A.slice(o.i1, o.i2), after = B.slice(o.j1, o.j2);
      const bt = before.map(b => b.text).join('\n'), at = after.map(b => b.text).join('\n');
      let near = '';
      // nearest section heading; the page H1 (block 0) counts as "Top of page"
      for (let k = o.j1 - 1; k >= 1; k--) if (B[k].heading) { near = B[k].text; break; }
      if (!near) for (let k = Math.max(o.j1, 1); k < o.j2; k++) if (B[k].heading) { near = B[k].text; break; }
      const sameImgs = before.flatMap(b => b.imgs).join() === after.flatMap(b => b.imgs).join();
      const change = { near, diff: textDiff(bt, at), kinds: [o.t] };
      if (sameImgs && bt && at && norm(bt) === norm(at)) { r.cosmetic.push(change); continue; }
      // orientation: one block of context above (if short); an empty side shows its neighbours
      const ctxA = o.i1 > 0 && A[o.i1 - 1].h < 260 ? [A[o.i1 - 1]] : [];
      const ctxB = o.j1 > 0 && B[o.j1 - 1].h < 260 ? [B[o.j1 - 1]] : [];
      const sideA = before.length ? [...ctxA, ...before] : [...ctxA, ...(A[o.i1] ? [A[o.i1]] : [])];
      const sideB = after.length ? [...ctxB, ...after] : [...ctxB, ...(B[o.j1] ? [B[o.j1]] : [])];
      change.before = await shot(bp, sideA);
      change.after = await shot(ap, sideB);
      change.emptyBefore = !before.length; change.emptyAfter = !after.length;
      imgBytes += (change.before?.bytes || 0) + (change.after?.bytes || 0);
      r.visual.push(change);
    }
  } else if (r.status === 'new') {
    r.whole = await shot(ap, await extract(ap)); imgBytes += r.whole?.bytes || 0;
  } else if (r.status === 'gone') {
    r.whole = await shot(bp, await extract(bp)); imgBytes += r.whole?.bytes || 0;
  }
  process.stderr.write(`${r.status}: ${r.visual.length} visual, ${r.cosmetic.length} cosmetic\n`);
  results.push(r);
  for (const pg of [bp, ap]) await pg?.close();
}
await browser.close();
server.close();

// ---- 4. report ------------------------------------------------------------------------------
const totals = results.reduce((t, r) => ({ v: t.v + r.visual.length, c: t.c + r.cosmetic.length }), { v: 0, c: 0 });
const anchor = (r) => `p-${r.slug.replace(/[^\w]+/g, '-')}`;
const figure = (label, s, empty, cls) => `
      <figure class="side ${cls}">
        <figcaption>${label}${empty ? ' <span class="note">nothing here; neighbours shown</span>' : ''}</figcaption>
        ${s ? `<img src="${s.src}" alt="${label} rendering" loading="lazy">${s.cut ? '<p class="note">cut at 1800 px</p>' : ''}` : '<p class="note">no blocks</p>'}
      </figure>`;
const pageLink = (base, url, label) => base ? `<a href="${esc(base + url)}">${label}</a>` : '';

const html = `<title>${esc(TITLE)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column of change cards; inside a card, before and after sit side by side and stack on phones. */
:root {
  --bg: #f6f7f9; --panel: #ffffff; --fg: #1b2330; --muted: #5b6676; --line: #dde2ea; --accent: #1f5fd1;
  --del-bg: #fde4e1; --del-fg: #8f1d12; --ins-bg: #dcf3e3; --ins-fg: #135c2c; --before: #b4321f; --after: #1b7a3d;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #11151b; --panel: #181e26; --fg: #e3e8ef; --muted: #98a3b3; --line: #2a3340; --accent: #7aa7ff;
  --del-bg: #4a1f1b; --del-fg: #ffb4a9; --ins-bg: #173a24; --ins-fg: #9fe2b3; --before: #ff8a76; --after: #6fd492; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #11151b; --panel: #181e26; --fg: #e3e8ef; --muted: #98a3b3; --line: #2a3340; --accent: #7aa7ff;
  --del-bg: #4a1f1b; --del-fg: #ffb4a9; --ins-bg: #173a24; --ins-fg: #9fe2b3; --before: #ff8a76; --after: #6fd492; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 15px/1.55 var(--sans); }
.wrap { max-width: 1280px; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 28px; }
h1, h2, h3 { text-wrap: balance; margin: 0; }
h1 { font-size: 1.6rem; font-weight: 600; }
h2 { font-size: 1.2rem; font-weight: 600; }
h3 { font-size: .95rem; font-weight: 500; color: var(--muted); }
a { color: var(--accent); }
a:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.meta { color: var(--muted); font-size: .85rem; display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 6px; }
code, .mono { font-family: var(--mono); font-size: .85em; }
.tablewrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: .9rem; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-weight: 500; color: var(--muted); font-size: .8rem; letter-spacing: .04em; text-transform: uppercase; }
td.num { text-align: right; }
.pill { display: inline-block; font-size: .75rem; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
.pill.new { color: var(--after); border-color: var(--after); } .pill.gone { color: var(--before); border-color: var(--before); }
section.page { display: grid; gap: 14px; }
.page-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
.page-head .links { font-size: .85rem; display: flex; gap: 12px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; display: grid; gap: 12px; min-width: 0; }
.sides { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 14px; }
.side { margin: 0; min-width: 0; display: grid; gap: 6px; align-content: start; }
.side img { max-width: 100%; height: auto; border: 1px solid var(--line); border-radius: 4px; background: #fff; }
figcaption { font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.side.b figcaption { color: var(--before); } .side.a figcaption { color: var(--after); }
.note { font-size: .78rem; color: var(--muted); font-weight: 400; letter-spacing: 0; text-transform: none; margin: 0; }
.diff { font-family: var(--mono); font-size: .8rem; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg); border-radius: 6px; padding: 10px 12px; margin: 0; }
del { background: var(--del-bg); color: var(--del-fg); text-decoration: line-through; }
ins { background: var(--ins-bg); color: var(--ins-fg); text-decoration: none; }
details { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; }
summary { cursor: pointer; color: var(--muted); font-size: .9rem; }
details .list { display: grid; gap: 8px; margin-top: 10px; }
details .near { font-size: .78rem; color: var(--muted); margin: 0 0 2px; }
.empty { color: var(--muted); font-size: .9rem; margin: 0; }
</style>
<div class="wrap">
  <header>
    <h1>${esc(TITLE)}</h1>
    <div class="meta">
      <span>Branch <code>${esc(branch)}</code> at <code>${esc(head)}</code></span>
      <span>Changed since <code>${esc(BASE)}</code></span>
      <span>Before: ${esc(BEFORE.replace(/^https?:\/\//, ''))} (live)</span>
      <span>After: local build</span>
      <span>Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</span>
    </div>
  </header>
  <div class="tablewrap"><table>
    <thead><tr><th>Page</th><th>State</th><th class="num">Visible changes</th><th class="num">Case / punctuation only</th></tr></thead>
    <tbody>
${results.map(r => `      <tr><td><a href="#${anchor(r)}">${esc(r.title)}</a><br><span class="mono note">/${esc(r.slug)}/</span></td><td><span class="pill ${r.status}">${r.status}</span></td><td class="num">${r.visual.length}</td><td class="num">${r.cosmetic.length}</td></tr>`).join('\n')}
      <tr><td><strong>${results.length} pages</strong></td><td></td><td class="num"><strong>${totals.v}</strong></td><td class="num"><strong>${totals.c}</strong></td></tr>
    </tbody>
  </table></div>
${results.map(r => `
  <section class="page" id="${anchor(r)}">
    <div class="page-head">
      <h2>${esc(r.title)}</h2>
      <span class="pill ${r.status}">${r.status}</span>
      <span class="links">${pageLink(BEFORE, r.url, 'Live page')}${PREVIEW ? pageLink(PREVIEW, r.url, 'Preview') : ''}</span>
    </div>
    ${r.whole ? `<figure class="side ${r.status === 'new' ? 'a' : 'b'}"><figcaption>${r.status === 'new' ? 'After (new page)' : 'Before (page removed)'}</figcaption><img src="${r.whole.src}" alt="whole page" loading="lazy">${r.whole.cut ? '<p class="note">cut at 1800 px</p>' : ''}</figure>` : ''}
    ${r.status === 'missing' ? '<p class="empty">Not found on the live site or in the local build.</p>' : ''}
    ${r.status === 'changed' && !r.visual.length && !r.cosmetic.length ? '<p class="empty">No rendered difference (the change is in markup, comments or frontmatter).</p>' : ''}
${r.visual.map(c => `    <article class="card">
      <h3>${c.near ? `Under “${esc(c.near)}”` : 'Top of page'}</h3>
      <div class="sides">${figure('Before', c.before, c.emptyBefore, 'b')}${figure('After', c.after, c.emptyAfter, 'a')}
      </div>
      <pre class="diff">${c.diff}</pre>
    </article>`).join('\n')}
${r.cosmetic.length ? `    <details>
      <summary>${r.cosmetic.length} case or punctuation change${r.cosmetic.length > 1 ? 's' : ''} (headings, dashes, quotes)</summary>
      <div class="list">
${r.cosmetic.map(c => `        <div>${c.near ? `<p class="near">Under “${esc(c.near)}”</p>` : ''}<pre class="diff">${c.diff}</pre></div>`).join('\n')}
      </div>
    </details>` : ''}
  </section>`).join('\n')}
</div>
`;

fs.mkdirSync(OUT, { recursive: true });
const outFile = path.join(OUT, 'before-after.html');
fs.writeFileSync(outFile, html);
const mb = (Buffer.byteLength(html) / 1048576).toFixed(1);
console.error(`${results.length} pages · ${totals.v} visible · ${totals.c} cosmetic · ${mb} MB${Number(mb) > 15 ? ' (over 15 MB: lower --scale or --quality)' : ''}`);
console.log(outFile);
