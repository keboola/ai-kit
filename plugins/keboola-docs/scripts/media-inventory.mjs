#!/usr/bin/env node
// media-inventory.mjs: which media each page references, and which files under public/ nothing references.
//
//   node <plugin>/scripts/media-inventory.mjs [--root <dir>] [--json] [--dates] [--index] [--dist] [--twins] [page-or-dir ...]
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
// --dates  adds each public file's last commit date (one git call per file). That is when the file
//          last changed in git, not when it was shot: files moved in the Jekyll→Astro migration all
//          read 2026-03-18. Open the image to judge whether it predates a UI change.
// --twins  lists byte-identical media under src/content/docs and public (same git blob): delete
//          both copies of a retired shot, or one copy keeps a stale file alive. With page arguments,
//          only the sets that hold one of those pages' media (--all: every set in the repo).
// --text <label>  (repeatable, macOS) OCRs the named pages' images (all with --all) with the docs-clip
//          OCR script and lists the ones that show the label, plus any that show an e-mail address. Use
//          it when a UI label changed: the dates above cannot say which screenshot shows the old one
//          (human test T1, 2026-10-21: 66 shots still showed "New Table Input").
// Exit 1 when a page references a file that does not exist. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { makeSource } from './lib/source.mjs';
import { MEDIA_EXT, pageRefs, extractHtmlRefs, extractRefs, isExternal } from './lib/media-refs.mjs';

const args = process.argv.slice(2);
const flagVal = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? null) : null; };
const has = (n) => args.includes(n);
const ROOT = path.resolve(flagVal('--root') ?? process.cwd());
const DOCS = path.join(ROOT, 'src', 'content', 'docs');
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');
const TEXTS = args.flatMap((a, i) => (a === '--text' && args[i + 1] ? [args[i + 1]] : []));
const JSON_OUT = has('--json'), DATES = has('--dates'), INDEX = has('--index'), USE_DIST = has('--dist'), TWINS = has('--twins');
const src = makeSource(ROOT, { index: INDEX, prefixes: ['src/content/docs', 'public'] });
if (!src.exists(DOCS)) { console.error(`✗ src/content/docs not found under ${ROOT}`); process.exit(2); }
if (USE_DIST && !fs.existsSync(DIST)) { console.error('✗ --dist asked but dist/ is missing: run `npm run build` first'); process.exit(2); }

const isPage = (f) => /\.(md|mdx)$/.test(f);
const selected = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) { if (a === '--root' || a === '--text') i++; continue; }
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

// ---- byte-identical copies (tracked files, by git blob id) ---------------------------------------------
let twins = [];
if (TWINS) {
  const byBlob = new Map();
  let ls = '';
  try { ls = execSync('git ls-files -s -z -- src/content/docs public', { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); } catch { /* not a git checkout */ }
  for (const rec of ls.split('\0')) {
    const m = rec.match(/^\d+ ([0-9a-f]+) \d+\t(.+)$/);
    if (!m || !MEDIA_EXT.test(m[2])) continue;
    if (!byBlob.has(m[1])) byBlob.set(m[1], []);
    byBlob.get(m[1]).push(m[2]);
  }
  twins = [...byBlob.values()].filter((g) => g.length > 1).map((g) => g.sort()).sort((a, b) => a[0].localeCompare(b[0]));
  // V8 field test: one page's run printed all 1,070 sets in the repo.
  if (selected.length && !has('--all')) {
    const mine = new Set(pages.flatMap((p) => p.media.map((m) => m.resolved)));
    twins = twins.filter((g) => g.some((f) => mine.has(f)));
  }
}

// ---- images that show a label (OCR) ------------------------------------------------------------------
let textHits = null;
if (TEXTS.length) {
  textHits = { terms: TEXTS, images: [], emails: [] };
  const swift = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'docs-clip', 'scripts', 'ocr-scan.swift');
  const bin = path.join(os.tmpdir(), 'kbl-ocr-scan');
  if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(swift).mtimeMs) {
    const c = spawnSync('swiftc', ['-O', swift, '-o', bin], { encoding: 'utf8' });
    if (c.status !== 0) { console.error(`✗ --text needs swiftc (macOS): ${(c.stderr || '').split('\n')[0]}`); process.exit(2); }
  }
  const imgs = [...new Set((has('--all') || !selected.length ? publicMedia.map((f) => f) : pages.flatMap((p) => p.media.map((m) => m.resolved))))]
    .filter((f) => /\.(png|jpe?g)$/i.test(f) && fs.existsSync(path.join(ROOT, f)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-ocr-'));
  imgs.forEach((f, i) => fs.symlinkSync(path.join(ROOT, f), path.join(tmp, `${String(i).padStart(5, '0')}${path.extname(f).toLowerCase()}`)));
  const r = spawnSync(bin, [tmp, ...TEXTS], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const line of (r.stdout || '').split('\n')) {
    const [f, kind, text] = line.split('\t');
    if (!text) continue;
    const img = imgs[parseInt(f, 10)];
    const bucket = kind === 'EMAIL' ? textHits.emails : textHits.images;
    if (!bucket.some((x) => x.file === img)) bucket.push({ file: img, text: text.trim() });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

const result = { root: ROOT, source: INDEX ? 'index' : 'worktree', unreferencedFrom: USE_DIST ? 'dist' : 'pages', pages, unreferenced, ...(TWINS ? { twins } : {}), ...(textHits ? { textHits } : {}),
  totals: { pages: pages.length, media: pages.reduce((n, p) => n + p.media.length, 0), missing: pages.reduce((n, p) => n + p.media.filter((m) => !m.exists).length, 0), unreferenced: unreferenced.length } };
if (JSON_OUT) { console.log(JSON.stringify(result, null, 2)); process.exitCode = result.totals.missing ? 1 : 0; }
else {
  for (const p of pages) {
    console.log(`\n${p.page}${p.media.length ? '' : '  (no media)'}`);
    for (const m of p.media) console.log(`  ${m.kind.padEnd(7)} ${m.path}${m.via === 'colocated' ? '  (next to the page)' : ''}${m.exists ? '' : '  MISSING'}${m.lastCommit ? '  ' + m.lastCommit : ''}${m.referencedBy.length > 1 ? `  (also on ${m.referencedBy.length - 1} other page${m.referencedBy.length > 2 ? 's' : ''})` : ''}`);
  }
  if (textHits) {
    console.log(`\n= ${textHits.images.length} image(s) show ${TEXTS.map((t) => JSON.stringify(t)).join(' or ')}${textHits.images.length ? ':' : ''}`);
    for (const h of textHits.images) console.log(`  ${h.file}  ("${h.text}")`);
    if (textHits.emails.length) console.log(`! ${textHits.emails.length} image(s) show an e-mail address (privacy, PRDCT-616): ${textHits.emails.map((h) => h.file).join(', ')}`);
  }
  if (TWINS && twins.length) { console.log(`\n= ${twins.length} set(s) of byte-identical media:`); for (const g of twins) console.log(`  ${g.join('  =  ')}`); }
  // Scoped to some pages, the site-wide orphan list is noise: print the count, the list only for a whole-site run.
  if (unreferenced.length && (!selected.length || has('--all'))) { console.log(`\n! ${unreferenced.length} file(s) under public/ referenced by no ${USE_DIST ? 'built page' : 'page source'}:`); for (const f of unreferenced) console.log(`  public/${f}`); }
  else if (unreferenced.length) console.log(`\n(${unreferenced.length} file(s) under public/ are referenced by no ${USE_DIST ? 'built page' : 'page source'} site-wide; run without page arguments, or with --all, to list them)`);
  console.log(`\n${result.totals.missing ? '✗' : '✓'} ${result.totals.pages} page(s) · ${result.totals.media} media ref(s) · ${result.totals.missing} missing · ${result.totals.unreferenced} unreferenced${USE_DIST ? ' (from dist/)' : ''}`);
  process.exitCode = result.totals.missing ? 1 : 0;
}
