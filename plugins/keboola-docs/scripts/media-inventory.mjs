#!/usr/bin/env node
// media-inventory.mjs: which media each page references, and which files under public/ nothing references.
//
//   node <plugin>/scripts/media-inventory.mjs [--root <dir>] [--json] [--dates] [--index] [--dist] [page-or-dir ...]
//
// Page refs come from scripts/lib/media-refs.mjs: markdown images (inline and reference-style),
// <img>/<video>/<source>, srcset, a component's src= with a media extension, frontmatter
// image/poster/cover; fenced code and comments are skipped. Relative refs resolve first next to the
// page (Astro bundles those, so they do not keep a public/ copy alive), then against the page URL
// under public/ (raw <img>, the markdown twins).
//
// --index  read pages from the git index (what the next commit records), not the working tree.
// --dist   ground truth for `unreferenced`: a public/ file counts as used when any built page in dist/
//          (HTML or markdown twin) points at it. Use this before deleting anything; needs `npm run build`.
// --dates  adds each public file's last commit date (one git call per file).
// Exit 1 when a page references a file that does not exist. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { makeSource } from './lib/source.mjs';
import { MEDIA_EXT, pageRefs, extractHtmlRefs, extractRefs, isExternal } from './lib/media-refs.mjs';

const args = process.argv.slice(2);
const flagVal = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? null) : null; };
const has = (n) => args.includes(n);
const ROOT = path.resolve(flagVal('--root') ?? process.cwd());
const DOCS = path.join(ROOT, 'src', 'content', 'docs');
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');
const JSON_OUT = has('--json'), DATES = has('--dates'), INDEX = has('--index'), USE_DIST = has('--dist');
const src = makeSource(ROOT, { index: INDEX, prefixes: ['src/content/docs', 'public'] });
if (!src.exists(DOCS)) { console.error(`✗ src/content/docs not found under ${ROOT}`); process.exit(2); }
if (USE_DIST && !fs.existsSync(DIST)) { console.error('✗ --dist asked but dist/ is missing: run `npm run build` first'); process.exit(2); }

const isPage = (f) => /\.(md|mdx)$/.test(f);
const selected = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) { if (a === '--root') i++; continue; }
  const p = path.resolve(ROOT, a);
  const kids = src.list(p, isPage);
  if (kids.length) selected.push(...kids); else selected.push(p);
}
const allPages = src.list(DOCS, isPage);
const wanted = new Set((selected.length ? selected : allPages).map((p) => path.resolve(p)));
const lastCommit = (rel) => { try { return execSync(`git log -1 --format=%cs -- "${rel}"`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { return null; } };
const toPath = (r) => (r.resolved.startsWith('public/') ? '/' + r.resolved.slice('public/'.length) : r.resolved);

const referenced = new Map(); // repo-relative resolved path → [pages]
const pages = [];
for (const abs of allPages) {
  const rel = path.relative(ROOT, abs);
  const { refs } = pageRefs(abs, src.read(abs), { root: ROOT, exists: src.exists, docsDir: DOCS });
  const media = [];
  for (const r of refs) {
    if (!referenced.has(r.resolved)) referenced.set(r.resolved, []);
    referenced.get(r.resolved).push(rel);
    media.push({ path: toPath(r), raw: r.raw, resolved: r.resolved, via: r.via, kind: r.kind, alt: r.alt, line: r.line,
      exists: r.via !== 'missing', ...(DATES && r.via === 'public' ? { lastCommit: lastCommit(r.resolved) } : {}) });
  }
  if (wanted.has(abs)) pages.push({ page: rel, media });
}
for (const p of pages) for (const m of p.media) m.referencedBy = referenced.get(m.resolved) ?? [];

// ---- unreferenced public media ---------------------------------------------------------------------------
const publicMedia = src.list(PUBLIC, (f) => MEDIA_EXT.test(f)).map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
let used = new Set(referenced.keys());
if (USE_DIST) {
  used = new Set();
  const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (/\.(html|md)$/.test(e.name)) out.push(p); } return out; };
  for (const f of walk(DIST)) {
    const relDir = path.relative(DIST, path.dirname(f)).replace(/\\/g, '/');
    const base = new URL(`https://site/${relDir ? relDir + '/' : ''}`);
    const text = fs.readFileSync(f, 'utf8');
    const refs = f.endsWith('.html') ? extractHtmlRefs(text) : extractRefs(text);
    for (const r of refs) {
      if (isExternal(r.raw)) continue;
      let p; try { p = decodeURI(new URL(r.raw, base).pathname); } catch { continue; }
      used.add('public' + p);
    }
  }
}
const unreferenced = publicMedia.filter((f) => !used.has(f)).map((f) => f.replace(/^public\//, '')).sort();

const result = { root: ROOT, source: INDEX ? 'index' : 'worktree', unreferencedFrom: USE_DIST ? 'dist' : 'pages', pages, unreferenced,
  totals: { pages: pages.length, media: pages.reduce((n, p) => n + p.media.length, 0), missing: pages.reduce((n, p) => n + p.media.filter((m) => !m.exists).length, 0), unreferenced: unreferenced.length } };
if (JSON_OUT) { console.log(JSON.stringify(result, null, 2)); process.exitCode = result.totals.missing ? 1 : 0; }
else {
  for (const p of pages) {
    console.log(`\n${p.page}${p.media.length ? '' : '  (no media)'}`);
    for (const m of p.media) console.log(`  ${m.kind.padEnd(7)} ${m.path}${m.via === 'colocated' ? '  (next to the page)' : ''}${m.exists ? '' : '  MISSING'}${m.lastCommit ? '  ' + m.lastCommit : ''}${m.referencedBy.length > 1 ? `  (also on ${m.referencedBy.length - 1} other page${m.referencedBy.length > 2 ? 's' : ''})` : ''}`);
  }
  if (unreferenced.length) { console.log(`\n! ${unreferenced.length} file(s) under public/ referenced by no ${USE_DIST ? 'built page' : 'page source'}:`); for (const f of unreferenced) console.log(`  public/${f}`); }
  console.log(`\n${result.totals.missing ? '✗' : '✓'} ${result.totals.pages} page(s) · ${result.totals.media} media ref(s) · ${result.totals.missing} missing · ${result.totals.unreferenced} unreferenced${USE_DIST ? ' (from dist/)' : ''}`);
  process.exitCode = result.totals.missing ? 1 : 0;
}
