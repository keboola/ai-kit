#!/usr/bin/env node
// check.mjs — link & redirect check for keboola/connection-docs after a rewrite. Read-only.
//
// Run from the repo root after `npm run build`:
//   node <plugin>/skills/docs-link-redirect-check/scripts/check.mjs [--base keboola/main] [--paths <prefix>]
//        [--site] [--preview <url>] [--no-build-check]
//
// What it checks (see SKILL.md for the reasoning):
//   1. pages deleted/renamed since --base → their old URL is in some page's redirect_from
//   2. every redirect_from on changed pages → a dist stub exists, points at a real page, no chain
//   3. inbound links to retired slugs anywhere in src/ or the nav
//   4. nav urls resolve to real pages (not stubs)
//   5. changed pages: internal links + #anchors + media resolve in dist/
//   6. src/sidebar.mjs matches what convert-nav.mjs generates
// Exit 1 on any blocker. Never edits anything.

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? true) : null; };
const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const DOCS = path.join(ROOT, 'src', 'content', 'docs');
const SITE = !!flag('--site');
const PREVIEW = typeof flag('--preview') === 'string' ? flag('--preview').replace(/\/$/, '') : null;
const PATHS = typeof flag('--paths') === 'string' ? flag('--paths') : null;

const sh = (cmd) => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const fail = (m) => { console.error(`✗ ${m}`); process.exit(2); };
if (!fs.existsSync(DIST)) fail('dist/ not found — run `npm run build` first');
if (!fs.existsSync(DOCS)) fail('src/content/docs not found — run from the repo root');

// ---- base ref -------------------------------------------------------------------------------
let base = typeof flag('--base') === 'string' ? flag('--base') : null;
if (!base) base = sh('git rev-parse --verify -q origin/main') ? 'origin/main' : (sh('git rev-parse --verify -q main') ? 'main' : null);
if (!base) fail('no --base and neither origin/main nor main exists');
const mergeBase = sh(`git merge-base ${base} HEAD`) || base;

// ---- dist freshness guard -------------------------------------------------------------------
if (!flag('--no-build-check')) {
  const newest = (dir) => { let t = 0; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else t = Math.max(t, fs.statSync(p).mtimeMs); } })(dir); return t; };
  const distT = fs.statSync(DIST).mtimeMs, srcT = Math.max(newest(DOCS), newest(path.join(ROOT, 'public')));
  if (srcT > distT + 2000) console.log(`! dist/ is older than src/content or public/ — results may be stale; rebuild to be sure`);
}

// ---- frontmatter helpers --------------------------------------------------------------------
const fm = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/); if (!m) return {};
  const out = {}; const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const kv = l.match(/^([A-Za-z_]+):\s*(.*)$/); if (!kv) continue;
    const [, k, v] = kv;
    if (v === '' || v === '|' ) { const arr = []; while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) arr.push(lines[++i].replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, '')); out[k] = arr.length ? arr : v; }
    else if (/^\[.*\]$/.test(v)) out[k] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    else out[k] = v.replace(/^['"]|['"]$/g, '');
  }
  return out;
};
const norm = (u) => { let s = u.split('#')[0].split('?')[0]; if (!s.startsWith('/')) s = '/' + s; if (!/\.[a-z0-9]+$/i.test(s) && !s.endsWith('/')) s += '/'; return s; };
const slugToUrl = (slug) => norm('/' + String(slug).replace(/^\/|\/$/g, '') + '/');
const pageUrlOf = (file, text) => { const f = fm(text); if (f.slug) return slugToUrl(f.slug); const rel = path.relative(DOCS, file).replace(/\\/g, '/').replace(/\.(md|mdx)$/, '').replace(/\/index$/, '').replace(/^index$/, ''); return rel ? slugToUrl(rel) : '/'; };
const readAt = (ref, file) => sh(`git show ${ref}:${JSON.stringify(path.relative(ROOT, file).replace(/\\/g, '/'))}`);

// ---- all current pages: url → {file, redirect_from} -----------------------------------------
const pages = new Map(); const redirects = new Map(); // oldUrl → newUrl
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(md|mdx)$/.test(e.name)) { const t = fs.readFileSync(p, 'utf8'); const url = pageUrlOf(p, t); const f = fm(t); pages.set(url, { file: p, fm: f }); const rf = f.redirect_from ? (Array.isArray(f.redirect_from) ? f.redirect_from : [f.redirect_from]) : []; for (const r of rf) redirects.set(norm(r), url); } } })(DOCS);

// ---- changed / deleted / renamed since base --------------------------------------------------
const status = sh(`git diff --name-status -M ${mergeBase} -- src/content/docs`) + '\n' + sh('git status --porcelain -- src/content/docs').split('\n').map((l) => l.trim() ? `${l.slice(0, 2).trim().replace('??', 'A')}\t${l.slice(3)}` : '').join('\n');
const changed = new Set(), deleted = [], renamed = [];
for (const line of status.split('\n')) {
  if (!line.trim()) continue; const parts = line.split('\t'); const code = parts[0].trim();
  const isPage = (f) => /\.(md|mdx)$/.test(f || '');
  if (code.startsWith('R')) { if (isPage(parts[2])) { renamed.push([parts[1], parts[2]]); changed.add(parts[2]); } }
  else if (code.startsWith('D')) { if (isPage(parts[1])) deleted.push(parts[1]); }
  else if (/^(A|M|AM|MM|\?\?)$/.test(code) || code === 'A' || code === 'M') changed.add(parts[1]);
}
if (PATHS) (function walk(d) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(md|mdx)$/.test(e.name)) changed.add(path.relative(ROOT, p)); } })(path.join(ROOT, PATHS));
const changedFiles = [...changed].map((r) => path.join(ROOT, r)).filter((p) => fs.existsSync(p) && /\.(md|mdx)$/.test(p));

// old URLs of deleted / renamed pages, from their frontmatter at the base
const retired = []; // {oldUrl, from}
for (const d of deleted) { const t = readAt(mergeBase, path.join(ROOT, d)); if (t) retired.push({ oldUrl: pageUrlOf(path.join(ROOT, d), t), from: `deleted ${d}` }); }
for (const [o, n] of renamed) { const t = readAt(mergeBase, path.join(ROOT, o)); const nt = fs.existsSync(path.join(ROOT, n)) ? fs.readFileSync(path.join(ROOT, n), 'utf8') : ''; if (t) { const ou = pageUrlOf(path.join(ROOT, o), t), nu = nt ? pageUrlOf(path.join(ROOT, n), nt) : null; if (ou !== nu) retired.push({ oldUrl: ou, from: `renamed ${o} → ${n}` }); } }
// slug changes on modified pages
for (const f of changedFiles) { const rel = path.relative(ROOT, f); const old = readAt(mergeBase, f); if (!old) continue; const ou = pageUrlOf(f, old), nu = pageUrlOf(f, fs.readFileSync(f, 'utf8')); if (ou !== nu) retired.push({ oldUrl: ou, from: `slug changed in ${rel}` }); }

// ---- dist helpers ---------------------------------------------------------------------------
const distFile = (url) => { const u = norm(url); const p = path.join(DIST, u.endsWith('/') ? u + 'index.html' : u); return fs.existsSync(p) ? p : null; };
const isStub = (file) => { if (!file) return false; const t = fs.readFileSync(file, 'utf8'); return /http-equiv="refresh"/i.test(t) && t.length < 4000; };
const stubTarget = (file) => { const m = fs.readFileSync(file, 'utf8').match(/http-equiv="refresh"\s+content="\d+;\s*url=([^"]+)"/i); return m ? norm(m[1]) : null; };
const realPage = (url) => { const f = distFile(url); return f && !isStub(f); };

const report = { retiredNoRedirect: [], stubBad: [], inbound: [], navBad: [], brokenLinks: [], brokenAnchors: [], mediaMissing: [], sidebar: [], preview: [] };

// 1. retired URLs must be redirected
for (const r of retired) { if (!redirects.has(r.oldUrl) && !realPage(r.oldUrl)) report.retiredNoRedirect.push(`${r.oldUrl}   (${r.from})`); }

// 2. redirect_from on changed pages (and on retired URLs) → stub present, correct, no chain
const toCheck = new Map();
for (const f of changedFiles) { const t = fs.readFileSync(f, 'utf8'); const url = pageUrlOf(f, t); const rf = fm(t).redirect_from; for (const r of (rf ? (Array.isArray(rf) ? rf : [rf]) : [])) toCheck.set(norm(r), url); }
for (const r of retired) if (redirects.has(r.oldUrl)) toCheck.set(r.oldUrl, redirects.get(r.oldUrl));
for (const [oldUrl, newUrl] of toCheck) {
  const f = distFile(oldUrl);
  if (!f) { report.stubBad.push(`${oldUrl}  →  no dist file at all (expected a redirect stub to ${newUrl})`); continue; }
  if (!isStub(f)) { if (norm(oldUrl) !== newUrl) report.stubBad.push(`${oldUrl}  →  is a real page, not a stub (redirect_from on ${newUrl} is shadowed)`); continue; }
  const tgt = stubTarget(f);
  if (!tgt) { report.stubBad.push(`${oldUrl}  →  stub without a readable refresh target`); continue; }
  if (tgt !== newUrl) report.stubBad.push(`${oldUrl}  →  stub points at ${tgt}, frontmatter says ${newUrl}`);
  const tf = distFile(tgt);
  if (!tf) report.stubBad.push(`${oldUrl}  →  ${tgt} does not exist in dist`);
  else if (isStub(tf)) report.stubBad.push(`${oldUrl}  →  ${tgt} is itself a redirect (chain)`);
}

// 3. inbound links to retired slugs (src + nav + sidebar), excluding redirect_from lines
const retiredUrls = [...new Set([...retired.map((r) => r.oldUrl), ...toCheck.keys()])];
if (retiredUrls.length) {
  const files = sh(`git ls-files src _data`).split('\n').filter((f) => f && /\.(md|mdx|astro|yml|yaml|mjs|ts|tsx|json)$/.test(f));
  for (const rel of files) { const p = path.join(ROOT, rel); if (!fs.existsSync(p)) continue; const lines = fs.readFileSync(p, 'utf8').split('\n'); lines.forEach((l, i) => { if (/redirect_from/.test(l) || /^\s+-\s+\//.test(l) && /redirect/.test(lines[i - 1] || '')) return; for (const u of retiredUrls) { const bare = u.replace(/\/$/, ''); if (l.includes(`](${u}`) || l.includes(`](${bare})`) || l.includes(`href="${u}`) || l.includes(`href="${bare}"`) || l.includes(`url: ${u}`) || l.includes(`slug: "${u.replace(/^\/|\/$/g, '')}"`)) report.inbound.push(`${rel}:${i + 1}  →  ${u}`); } }); }
}

// 4. nav urls → real pages
const navFile = path.join(ROOT, '_data', 'navigation.yml');
if (fs.existsSync(navFile)) for (const m of fs.readFileSync(navFile, 'utf8').matchAll(/^\s*-?\s*url:\s*(\S+)/gm)) { const u = norm(m[1]); if (/^https?:/.test(m[1])) continue; const f = distFile(u); if (!f) report.navBad.push(`${u}  (no page in dist)`); else if (isStub(f)) report.navBad.push(`${u}  (redirect stub — nav points at a retired URL)`); }

// 5. links, anchors and media on changed pages (or the whole site with --site)
const htmlFiles = [];
if (SITE) (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'index.html') htmlFiles.push(p); } })(DIST);
else for (const f of changedFiles) { const u = pageUrlOf(f, fs.readFileSync(f, 'utf8')); const df = distFile(u); if (df) htmlFiles.push(df); }
const idsOf = (file) => { const t = fs.readFileSync(file, 'utf8'); const ids = new Set(); for (const m of t.matchAll(/\s(?:id|name)="([^"]+)"/g)) ids.add(m[1]); return ids; };
const idCache = new Map();
for (const hf of htmlFiles) {
  const html = fs.readFileSync(hf, 'utf8'); const pageUrl = norm('/' + path.relative(DIST, path.dirname(hf)).replace(/\\/g, '/') + '/');
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  for (const m of main.matchAll(/<a\s[^>]*href="([^"]+)"/gi)) {
    const href = m[1]; if (!href.startsWith('/') && !href.startsWith('#')) continue; if (href.startsWith('/_astro/') || href.startsWith('/pagefind/')) continue;
    const [pathPart, frag] = href.split('#'); const target = pathPart ? norm(pathPart) : pageUrl; const tf = distFile(target);
    if (!tf) { report.brokenLinks.push(`${pageUrl}  →  ${href}`); continue; }
    if (isStub(tf) && !pathPart) continue;
    if (frag) { if (isStub(tf)) { report.brokenAnchors.push(`${pageUrl}  →  ${href}  (target is a redirect stub; anchors cannot survive)`); continue; } if (!idCache.has(tf)) idCache.set(tf, idsOf(tf)); if (!idCache.get(tf).has(decodeURIComponent(frag))) report.brokenAnchors.push(`${pageUrl}  →  ${href}`); }
  }
  for (const m of main.matchAll(/(?:<img[^>]*\ssrc|<source[^>]*\ssrc|\sposter)="([^"]+)"/gi)) { const src = m[1]; if (!src.startsWith('/') || src.startsWith('/_astro/')) continue; if (!fs.existsSync(path.join(DIST, src.split('?')[0]))) report.mediaMissing.push(`${pageUrl}  →  ${src}`); }
}

// 6. sidebar in sync with the nav
const conv = path.join(ROOT, 'scripts', 'convert-nav.mjs'), sidebar = path.join(ROOT, 'src', 'sidebar.mjs');
if (fs.existsSync(conv) && fs.existsSync(sidebar)) {
  const before = fs.readFileSync(sidebar, 'utf8');
  const r = spawnSync(process.execPath, [conv], { cwd: ROOT, encoding: 'utf8' });
  const after = fs.readFileSync(sidebar, 'utf8');
  if (r.status === 0 && before !== after) { report.sidebar.push('src/sidebar.mjs differs from convert-nav.mjs output — run `npm run gen:sidebar` and commit'); fs.writeFileSync(sidebar, before); }
  else if (r.status !== 0) report.sidebar.push(`convert-nav.mjs failed: ${(r.stderr || '').split('\n')[0]}`);
}

// 7. preview, if asked
if (PREVIEW) {
  const get = async (u) => { try { const r = await fetch(PREVIEW + u, { redirect: 'manual' }); const body = r.status === 200 ? await r.text() : ''; return { status: r.status, loc: r.headers.get('location'), refresh: body.match(/http-equiv="refresh"\s+content="\d+;\s*url=([^"]+)"/i)?.[1] ?? null }; } catch (e) { return { status: 0, err: e.message }; } };
  for (const [oldUrl, newUrl] of toCheck) { const r = await get(oldUrl); const ok = (r.status === 200 && r.refresh && norm(r.refresh) === newUrl) || ((r.status === 301 || r.status === 308) && r.loc && norm(r.loc) === newUrl); if (!ok) report.preview.push(`${oldUrl}  →  ${r.status} ${r.loc ?? r.refresh ?? r.err ?? ''} (expected → ${newUrl})`); }
  for (const f of changedFiles) { const u = pageUrlOf(f, fs.readFileSync(f, 'utf8')); const r = await get(u); if (r.status !== 200 || r.refresh) report.preview.push(`${u}  →  ${r.status}${r.refresh ? ' (redirects to ' + r.refresh + ')' : ''}`); }
}

// ---- report ---------------------------------------------------------------------------------
const dump = (title, arr, blocker) => { if (!arr.length) return; console.log(`\n${blocker ? '✗' : '!'} ${title} (${arr.length})`); for (const x of arr) console.log(`  ${x}`); };
console.log(`link & redirect check · base ${base} (merge-base ${mergeBase.slice(0, 8)}) · ${changedFiles.length} changed page(s) · ${retired.length} retired URL(s) · ${toCheck.size} redirect(s) checked${SITE ? ' · site-wide anchors/media' : ''}${PREVIEW ? ' · preview ' + PREVIEW : ''}`);
dump('RETIRED URL WITHOUT REDIRECT', report.retiredNoRedirect, true);
dump('REDIRECT STUB MISSING OR WRONG', report.stubBad, true);
dump('NAV ENTRY WITHOUT A REAL PAGE', report.navBad, true);
dump('BROKEN LINK ON A CHANGED PAGE', report.brokenLinks, true);
dump('BROKEN ANCHOR ON A CHANGED PAGE', report.brokenAnchors, true);
dump('MEDIA MISSING', report.mediaMissing, true);
dump('INBOUND LINKS TO A RETIRED SLUG', report.inbound, false);
dump('SIDEBAR OUT OF DATE', report.sidebar, false);
dump('PREVIEW MISMATCH', report.preview, true);
const blockers = report.retiredNoRedirect.length + report.stubBad.length + report.navBad.length + report.brokenLinks.length + report.brokenAnchors.length + report.mediaMissing.length + report.preview.length;
const warnings = report.inbound.length + report.sidebar.length;
console.log(`\n${blockers ? '✗' : '✓'} ${blockers} blocker(s), ${warnings} warning(s)`);
process.exit(blockers ? 1 : 0);
