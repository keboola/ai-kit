#!/usr/bin/env node
// repoint-anchors.mjs — after a page is split, point links at its old #anchors to the page that now
// holds each heading. Writes files (never dist/); keeps every file's line endings.
//
//   node <plugin>/scripts/repoint-anchors.mjs --page <slug> [--ref <ref>] [--to <slug> …]
//        [--map <file.json>] [--root <dir>] [--dry-run] [--json]
//
//   --page   the split page's URL (it still exists, usually as the explanation hub)
//   --ref    the page as it was before the split (default: the merge-base with keboola/main,
//            origin/main or main)
//   --to     a page that took part of the text, outside the page's own folder (repeatable). Pages
//            under the page's own URL (/storage/tables/manage/ for /storage/tables/) are searched always
//   --map    {"#old-anchor": "/new/page/#anchor" | "/new/page/" | null} overrides: a heading that was
//            renamed on the way, a section that became a whole page, or null to keep a link as it is
//
// For every heading the page had at --ref and no longer has, the target is the one page in the split
// that has a heading with the same id. Links that keep working (the hub still has the anchor) are left
// alone. Links to anchors with no target, or with several, are listed as unmapped and not touched.
// Then rebuild and run docs-link-redirect-check: it checks every link into a changed page's anchors.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flagVal = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? null) : null; };
const flagAll = (n) => args.flatMap((a, i) => (a === n && args[i + 1] ? [args[i + 1]] : []));
const has = (n) => args.includes(n);
const ROOT = path.resolve(flagVal('--root') ?? process.cwd());
const DOCS = path.join(ROOT, 'src', 'content', 'docs');
const DRY = has('--dry-run'), JSON_OUT = has('--json');
const die = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const norm = (s) => '/' + String(s ?? '').trim().replace(/^https?:\/\/help\.keboola\.com/, '').replace(/^\/+|\/+$/g, '') + '/';
const git = (a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (!fs.existsSync(DOCS)) die(`src/content/docs not found under ${ROOT}`);
if (!flagVal('--page')) die('usage: --page <slug> [--ref <ref>] [--to <slug> …] [--map <file.json>] [--dry-run] [--json]');
const PAGE = norm(flagVal('--page'));

let REF = flagVal('--ref');
if (!REF) {
  const base = ['keboola/main', 'upstream/main', 'origin/main', 'main'].find((r) => git(['rev-parse', '-q', '--verify', r]).status === 0);
  REF = base ? git(['merge-base', 'HEAD', base]).stdout.trim() : null;
  if (!REF) die('no --ref and no keboola/main, upstream/main, origin/main or main to take a merge-base from');
}

// ---- pages: url → file, read from the working tree ------------------------------------------------
const slugOf = (file, text) => {
  const m = text.match(/^---\r?\n[\s\S]*?^slug:\s*['"]?([^'"\r\n]*)['"]?\s*$/m);
  if (m) return norm(m[1]);
  return norm(path.relative(DOCS, file).replace(/\\/g, '/').replace(/\.(md|mdx)$/, '').replace(/(^|\/)index$/, ''));
};
const pages = new Map();
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (/\.(md|mdx)$/.test(e.name)) pages.set(slugOf(p, fs.readFileSync(p, 'utf8')), p);
} })(DOCS);
const hubFile = pages.get(PAGE);
if (!hubFile) die(`no page with the URL ${PAGE} under src/content/docs`);

// ---- heading ids, the way Starlight (github-slugger) makes them ------------------------------------
const plain = (h) => h.replace(/`([^`]*)`/g, '$1').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[*_]{2}([^*_]+)[*_]{2}/g, '$1');
const slugify = (s) => plain(s).toLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
const ids = (text) => {
  const out = new Set(), seen = new Map();
  let fence = null;
  for (const line of text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').split(/\r?\n/)) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
    if (fence) continue;
    const h = line.match(/^#{2,6}\s+(.*?)\s*#*\s*$/);
    if (!h) continue;
    const base = slugify(h[1]);
    const n = seen.get(base) ?? 0; seen.set(base, n + 1);
    out.add(n ? `${base}-${n}` : base);
  }
  return out;
};

const rel = path.relative(ROOT, hubFile).replace(/\\/g, '/');
const before = git(['show', `${REF}:${rel}`]);
if (before.status !== 0) die(`${rel} does not exist at ${REF}: pass --ref with the commit before the split`);
const oldIds = ids(before.stdout), nowIds = ids(fs.readFileSync(hubFile, 'utf8'));

// ---- the map: old anchor → new target ---------------------------------------------------------------
const candidates = [...pages].filter(([u]) => u !== PAGE && (u.startsWith(PAGE) || flagAll('--to').map(norm).includes(u)));
const candIds = candidates.map(([u, f]) => [u, ids(fs.readFileSync(f, 'utf8'))]);
let overrides = {};
if (flagVal('--map')) { try { overrides = JSON.parse(fs.readFileSync(path.resolve(flagVal('--map')), 'utf8')); } catch (e) { die(`--map: ${e.message}`); } }
const map = new Map(), ambiguous = {};
for (const id of oldIds) {
  const key = '#' + id;
  if (key in overrides) { if (overrides[key] !== null) map.set(id, overrides[key]); continue; }
  if (nowIds.has(id)) continue;
  const hits = candIds.filter(([, s]) => s.has(id)).map(([u]) => u);
  if (hits.length === 1) map.set(id, `${hits[0]}#${id}`); else if (hits.length > 1) ambiguous[key] = hits;
}
for (const [k, v] of Object.entries(overrides)) if (v !== null && !map.has(k.replace(/^#/, ''))) map.set(k.replace(/^#/, ''), v);

// ---- rewrite links in src/ and _data/ ---------------------------------------------------------------
const files = git(['ls-files', '-co', '--exclude-standard', '--', 'src', '_data']).stdout.split('\n')
  .filter((f) => f && /\.(md|mdx|astro|yml|yaml|mjs|ts|tsx|json)$/.test(f) && !f.startsWith('src/sidebar.mjs'));
const esc = PAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/$/, '');
const re = new RegExp(`(https?://help\\.keboola\\.com)?${esc}/?#([A-Za-z0-9_\\-\\p{L}\\p{N}%]+)`, 'gu');
const rewritten = {}, unmapped = [];
for (const f of files) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) continue;
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.includes(PAGE.replace(/\/$/, '') + '#') && !text.includes(PAGE + '#')) continue;
  let n = 0;
  const lineOf = (i) => text.slice(0, i).split('\n').length;
  const next = text.replace(re, (m, origin, id, offset) => {
    const to = map.get(decodeURIComponent(id));
    if (to) { n++; return (origin ?? '') + to; }
    if (!nowIds.has(decodeURIComponent(id))) unmapped.push(`${f}:${lineOf(offset)}  ${PAGE}#${id}${ambiguous['#' + id] ? `  (in ${ambiguous['#' + id].join(' and ')}: pass --map)` : ''}`);
    return m;
  });
  if (n) { rewritten[f] = n; if (!DRY) fs.writeFileSync(abs, next); }
}
// Relative #links inside the page itself that lost their heading: these need a hand edit.
const hubText = fs.readFileSync(hubFile, 'utf8');
const selfDangling = [...hubText.matchAll(/\]\(#([^)\s]+)\)/g)].filter((m) => !nowIds.has(m[1])).map((m) => `${rel}  (#${m[1]})`);

const result = { page: PAGE, ref: REF.slice(0, 12), map: Object.fromEntries(map), ambiguous, rewritten, unmapped, selfDangling, dryRun: DRY };
if (JSON_OUT) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }
const total = Object.values(rewritten).reduce((a, b) => a + b, 0);
console.log(`${DRY ? '(dry run) ' : ''}${PAGE}: ${map.size} moved anchor(s), ${total} link(s) ${DRY ? 'to rewrite' : 'rewritten'} in ${Object.keys(rewritten).length} file(s), base ${REF.slice(0, 9)}`);
for (const [k, v] of map) console.log(`  #${k}  →  ${v}`);
for (const [f, c] of Object.entries(rewritten)) console.log(`  ${f}: ${c}`);
if (unmapped.length) console.log(`! links to anchors with no single new home (fix by hand or pass --map):\n${unmapped.map((u) => '  ' + u).join('\n')}`);
if (selfDangling.length) console.log(`! in-page links on the hub to headings it no longer has:\n${selfDangling.map((u) => '  ' + u).join('\n')}`);
process.exit(0);
