#!/usr/bin/env node
// gate.mjs — PreToolUse(Bash) hook: the commit gate for keboola/connection-docs pages.
//
// Fires only on `git commit` in a checkout that has src/content/docs and _data/navigation.yml,
// and only when the staged set touches src/content/docs or public. Then:
//   1. docs-diataxis-check on staged pages (added/modified/renamed): D1–D16, FAIL tier denies
//   2. retired pages (deleted/renamed-from): some page must claim the old slug in redirect_from
//   3. media deleted under public/ that a page still references
//   4. docs-link-redirect-check, only when dist/ and scripts/convert-nav.mjs exist (never blocks on a missing build)
// Deny = JSON permissionDecision on stdout. WARN tier never blocks.
// Escape hatch: DOCS_GATE=skip (env or as a prefix of the command). DOCS_GATE=strict turns child timeouts into FAIL.
// Judges what the commit will record: staged blobs (git index), not the working tree. `git commit -a`
// stages tracked changes at commit time, so for -a/--all the gate reads the working tree instead.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeSource } from './lib/source.mjs';
import { pageRefs } from './lib/media-refs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIATAXIS = path.join(HERE, '..', 'skills', 'docs-diataxis-check', 'scripts', 'check.mjs');
const LINKS = path.join(HERE, '..', 'skills', 'docs-link-redirect-check', 'scripts', 'check.mjs');
const INVENTORY = path.join(HERE, 'media-inventory.mjs');
const CHILD_MS = 25000;
const MAX_LINES = 8;

const readStdin = () => { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } };
const out = (o) => { process.stdout.write(JSON.stringify(o)); };
const mode = (process.env.DOCS_GATE || '').toLowerCase();

let input;
try { input = JSON.parse(readStdin() || '{}'); } catch { process.exit(0); }
if (input.tool_name !== 'Bash') process.exit(0);
const cmd = String(input.tool_input?.command ?? '');

// `git commit`, also `git -C <dir> commit`, anywhere in a chain; not `git commit-tree`, not a word inside a string.
const commitRe = /(?:^|[;&|]\s*|\bthen\s+|\bdo\s+)(?:[A-Z_]+=\S+\s+)*git\s+(?:-C\s+(\S+)\s+)?(?:-c\s+\S+\s+)*commit\b(?!-)/;
const m = cmd.match(commitRe);
if (!m) process.exit(0);
if (mode === 'skip' || /(?:^|[;&|]\s*)DOCS_GATE=skip\s/.test(cmd)) { out({ systemMessage: 'docs gate skipped (DOCS_GATE=skip)' }); process.exit(0); }

const cwd = m[1] ? path.resolve(input.cwd || process.cwd(), m[1].replace(/^['"]|['"]$/g, '')) : (input.cwd || process.cwd());
const git = (args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const top = git(['rev-parse', '--show-toplevel']);
if (top.status !== 0) process.exit(0);
const root = top.stdout.trim();
if (!fs.existsSync(path.join(root, 'src', 'content', 'docs')) || !fs.existsSync(path.join(root, '_data', 'navigation.yml'))) process.exit(0);

// ---- staged set --------------------------------------------------------------------------------
// `git commit -a` / `--all` / `-am` commits tracked working-tree changes too.
const commitArgs = cmd.slice(m.index + m[0].length).split(/[;&|]/)[0];
const ALL = /(?:^|\s)(?:--all|-[A-Za-z]*a[A-Za-z]*)(?=\s|$)/.test(commitArgs);
const diff = git(['diff', ALL ? 'HEAD' : '--cached', '--name-status', '-M', '--', 'src/content/docs', 'public']);
const src = makeSource(root, { index: !ALL, prefixes: ['src/content/docs', '_data', 'public'] });
if (diff.status !== 0) process.exit(0);
const isPage = (f) => /\.(md|mdx)$/.test(f) && f.startsWith('src/content/docs/');
const pages = [], retired = [], deletedMedia = [];
for (const line of diff.stdout.split('\n')) {
  if (!line.trim()) continue;
  const [status, a, b] = line.split('\t');
  const s = status[0];
  if (s === 'D') { if (isPage(a)) retired.push(a); else if (a.startsWith('public/')) deletedMedia.push(a); }
  else if (s === 'R') { if (isPage(a)) retired.push(a); if (isPage(b)) pages.push(b); }
  else if (isPage(a)) pages.push(a);
}
if (!pages.length && !retired.length && !deletedMedia.length) process.exit(0);

const fails = [], warns = [];
const run = (file, args, extra = {}) => {
  const r = spawnSync(process.execPath, [file, ...args], { cwd: root, encoding: 'utf8', timeout: CHILD_MS, maxBuffer: 64 * 1024 * 1024, ...extra });
  return { ...r, timedOut: r.error?.code === 'ETIMEDOUT' };
};
const timeout = (what) => (mode === 'strict' ? fails : warns).push(`${what} timed out after ${CHILD_MS / 1000} s${mode === 'strict' ? '' : ' (DOCS_GATE=strict to fail on this)'}`);

// ---- 1. Diátaxis on staged pages ----------------------------------------------------------------
const existing = pages.filter((p) => src.exists(path.join(root, p)));
if (existing.length) {
  const args = ['--root', root, '--json', ...(ALL ? [] : ['--index']), ...(fs.existsSync(path.join(root, 'dist')) ? ['--dist'] : []), ...existing];
  const r = run(DIATAXIS, args);
  if (r.timedOut) timeout('diataxis check');
  else {
    let j = null; try { j = JSON.parse(r.stdout); } catch { /* fall through */ }
    if (!j) warns.push(`diataxis check gave no JSON (exit ${r.status}): ${(r.stderr || r.stdout).trim().split('\n')[0] || ''}`);
    else for (const p of j.pages ?? []) for (const f of p.findings ?? []) {
      const line = `${p.file}${f.line ? ':' + f.line : ''} ${f.id} ${f.msg}`;
      if (f.level === 'FAIL') fails.push(line); else if (f.level === 'WARN') warns.push(line);
    }
  }
}

// ---- 2. retired pages need a redirect_from somewhere ------------------------------------------
const slugOf = (f) => '/' + f.replace(/^src\/content\/docs\//, '').replace(/\.(md|mdx)$/, '').replace(/\/index$/, '').replace(/^index$/, '') + '/';
// A page that never reached the published base (keboola/main, else origin/main) has no URL anyone holds:
// dropping it from a branch needs no redirect.
const baseRef = ['keboola/main', 'origin/main', 'main'].find((r) => git(['rev-parse', '-q', '--verify', r]).status === 0);
if (baseRef) for (let i = retired.length - 1; i >= 0; i--) if (git(['cat-file', '-e', `${baseRef}:${retired[i]}`]).status !== 0) retired.splice(i, 1);
if (retired.length) {
  const claimed = new Set();
  for (const abs of src.list(path.join(root, 'src', 'content', 'docs'), (f) => /\.(md|mdx)$/.test(f))) {
    const text = src.read(abs);
    if (!text.includes('redirect_from')) continue;
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    for (const u of fm[1].match(/\/[A-Za-z0-9_./-]*\/?/g) ?? []) claimed.add(u.replace(/\/?$/, '/'));
  }
  for (const f of retired) {
    const slug = slugOf(f).replace(/\/+/g, '/');
    if (!claimed.has(slug)) fails.push(`${f} retired, but no page lists ${slug} in redirect_from (docs-retire adds it)`);
  }
}

// ---- 3. media deleted while still referenced ----------------------------------------------------
if (deletedMedia.length && fs.existsSync(INVENTORY)) {
  const r = run(INVENTORY, ['--root', root, '--json', ...(ALL ? [] : ['--index'])]);
  if (r.timedOut) timeout('media inventory');
  else {
    let j = null; try { j = JSON.parse(r.stdout); } catch { /* fall through */ }
    if (j) {
      const refs = new Map();
      for (const p of j.pages ?? []) for (const m of p.media ?? []) { if (!refs.has(m.resolved)) refs.set(m.resolved, []); refs.get(m.resolved).push(p.page); }
      for (const f of deletedMedia) { const by = refs.get(f); if (by?.length) fails.push(`${f} deleted, but still referenced by ${[...new Set(by)].join(', ')}`); }
      // Only media this commit orphans: files the staged pages referenced before (HEAD) and nobody references now.
      const before = new Set();
      for (const pg of pages) {
        const prev = git(['show', `HEAD:${pg}`]); if (prev.status !== 0) continue;
        const abs = path.join(root, pg);
        for (const r of pageRefs(abs, prev.stdout, { root, exists: src.exists, docsDir: path.join(root, 'src', 'content', 'docs') }).refs) if (r.resolved.startsWith('public/')) before.add(r.resolved);
      }
      const unref = new Set((j.unreferenced ?? []).map((u) => 'public/' + u));
      for (const o of before) if (unref.has(o) && !deletedMedia.includes(o)) warns.push(`${o} is referenced by no page any more (this commit dropped the last reference; delete it or keep it on purpose)`);
    }
  }
}

// ---- 4. links, only when a build exists ------------------------------------------------------------
if (fs.existsSync(path.join(root, 'dist')) && fs.existsSync(path.join(root, 'scripts', 'convert-nav.mjs'))) {
  const base = git(['rev-parse', '-q', '--verify', 'keboola/main']).status === 0 ? ['--base', 'keboola/main'] : [];
  const r = run(LINKS, [...base, '--no-build-check']);
  if (r.timedOut) timeout('link check');
  else if (r.status === 1) {
    for (const l of r.stdout.split('\n')) if (/^✗ /.test(l)) fails.push('links: ' + l.replace(/^✗ /, ''));
    if (!fails.some((l) => l.startsWith('links:'))) fails.push('links: link & redirect check reported blockers');
  } else if (r.status === 2) warns.push(`link check skipped: ${(r.stderr || '').trim().split('\n')[0]}`);
} else warns.push('no dist/ (or no scripts/convert-nav.mjs): link check skipped; `npm run build` then re-run docs-link-redirect-check');

// ---- verdict ----------------------------------------------------------------------------------------
const cut = (arr) => (arr.length > MAX_LINES ? [...arr.slice(0, MAX_LINES), `+${arr.length - MAX_LINES} more`] : arr);
const n = (x, w) => `${x} ${w}${x === 1 ? '' : 's'}`;
if (fails.length) {
  const reason = [`docs gate: ${fails.length} FAIL on ${n(pages.length + retired.length, 'page')}`, ...cut(fails).map((l) => '  ' + l),
    'Fix, re-run docs-diataxis-check (and docs-link-redirect-check), then commit again. DOCS_GATE=skip git commit … bypasses the gate.'].join('\n');
  out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
  process.exit(0);
}
const summary = `docs gate: ✓ ${n(pages.length, 'page')} · 0 fail · ${n(warns.length, 'warn')}`;
if (warns.length) out({ systemMessage: summary, hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: ['docs gate warnings (not blocking):', ...cut(warns).map((l) => '  ' + l)].join('\n') } });
else out({ systemMessage: summary });
process.exit(0);
