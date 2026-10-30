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
// and `git commit <paths>` take working-tree content at commit time, so for those the gate reads the
// working tree instead. `git add … && git commit` in one command is refused: this hook runs before the
// command, so it would judge the index without the files the same command stages.
// A FAIL that the same page already had on the merge-base with main is reported as a WARN ("already on
// main"): touching a page for one link must not drag its old form debt into the change. D9 (VERIFY
// owners) and D16 (template leftovers) are never downgraded.
// Every decision is appended to <git common dir>/keboola-docs/gate-log.jsonl (and ${CLAUDE_PLUGIN_DATA}/gate-log.jsonl)
// with the tree it judged, so docs-ship can tell whether HEAD went through the gate.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeSource } from './lib/source.mjs';
import { pageRefs } from './lib/media-refs.mjs';
import { segments, parseCommit, STAGING } from './lib/shell.mjs';

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

// `git commit` as a command of its own (shell.mjs): not `git commit-tree`, not text in a heredoc or a quoted string.
const segs = segments(cmd);
const ci = segs.findIndex((sg) => sg.git?.sub === 'commit');
if (ci < 0) process.exit(0);
const commitSeg = segs[ci];
const skipped = mode === 'skip' || commitSeg.env.DOCS_GATE === 'skip' || segs.slice(0, ci).some((sg) => sg.argv[0] === 'export' && sg.argv.includes('DOCS_GATE=skip'));

// `cd <repo> && git commit` from a session sitting elsewhere: follow the cd/pushd before the commit.
const home = process.env.HOME || '';
let baseDir = input.cwd || process.cwd();
for (const sg of segs.slice(0, ci)) {
  if ((sg.argv[0] === 'cd' || sg.argv[0] === 'pushd') && sg.argv.length <= 2) {
    const to = (sg.argv[1] ?? home).replace(/^~(?=\/|$)/, home);
    if (to !== '-') baseDir = path.resolve(baseDir, to);
  }
}
const cwd = commitSeg.git.C ? path.resolve(baseDir, commitSeg.git.C) : baseDir;
const git = (args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const top = git(['rev-parse', '--show-toplevel']);
if (top.status !== 0) process.exit(0);
const root = top.stdout.trim();
if (!fs.existsSync(path.join(root, 'src', 'content', 'docs')) || !fs.existsSync(path.join(root, '_data', 'navigation.yml'))) process.exit(0);

// ---- decision log (docs-ship reads it) -----------------------------------------------------------
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout?.trim() || null;
// The tree the commit will record: the index, or for -a / pathspecs the same thing git builds,
// done in a throwaway index so the real one is untouched.
let commitTree = () => git(['write-tree']).stdout?.trim() || null;
// The log lives in the repo's git dir (shared by its worktrees, never committed), so whichever way the
// plugin was loaded, gate-verdict finds it next to the commit. The plugin data dir keeps a copy.
const commonDir = git(['rev-parse', '--git-common-dir']).stdout?.trim();
const logDirs = [commonDir && path.join(path.resolve(cwd, commonDir), 'keboola-docs'), process.env.CLAUDE_PLUGIN_DATA].filter(Boolean);
const logDecision = (decision, extra = {}) => {
  try {
    const line = JSON.stringify({ at: new Date().toISOString(), repo: root, branch, tree: commitTree(), decision, ...extra }) + '\n';
    for (const dir of logDirs) { fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(path.join(dir, 'gate-log.jsonl'), line); }
  } catch { /* the log is a convenience, never a reason to fail */ }
};

if (skipped) {
  logDecision('skip', { scope: 'index' });
  out({ systemMessage: 'docs gate skipped (DOCS_GATE=skip)',
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 'docs gate skipped (DOCS_GATE=skip): nothing was checked. Say so in the handoff and in the PR body.' } });
  process.exit(0);
}

// ---- staging and committing in one command ---------------------------------------------------------
const stagesFirst = segs.slice(0, ci).find((sg) => sg.git && (
  (STAGING.has(sg.git.sub) && sg.git.sub !== 'restore' && sg.git.sub !== 'apply') ||
  (sg.git.sub === 'restore' && sg.git.args.includes('--staged')) ||
  (sg.git.sub === 'apply' && sg.git.args.includes('--cached'))));
if (stagesFirst) {
  logDecision('deny', { reason: 'stage-and-commit' });
  out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: [
    `docs gate: \`git ${stagesFirst.git.sub} …\` and \`git commit\` in one command.`,
    'The gate checks the index before this command runs, so whatever this command stages would be committed unchecked.',
    'Stage in one call, then commit in the next.'].join('\n') } });
  process.exit(0);
}

// ---- staged set --------------------------------------------------------------------------------
// `git commit -a` / `--all` / `-am` and `git commit <paths>` take working-tree content at commit time.
const scope = parseCommit(commitSeg.git.args);
// --pathspec-from-file: the paths are in a file ('-' is stdin, which the gate cannot read: no tree is logged)
if (scope.pathspecFile !== null && scope.pathspecFile !== '-') {
  try {
    const list = fs.readFileSync(path.resolve(cwd, scope.pathspecFile), 'utf8');
    scope.paths.push(...list.split(scope.nul ? '\0' : /\r?\n/).filter(Boolean));
  } catch { /* unreadable: git will fail the commit itself */ }
}
const ALL = scope.all || scope.paths.length > 0 || scope.pathspecFile !== null;
// --amend replaces HEAD, so the change to judge is everything since HEAD's parent, not just what is
// staged on top of HEAD (an amend with nothing staged used to pass unjudged and unlogged).
const AMEND = commitSeg.git.args.includes('--amend') && git(['rev-parse', '-q', '--verify', 'HEAD^']).status === 0;
const PARENT = AMEND ? 'HEAD^' : 'HEAD';
if (ALL) commitTree = () => {
  const tmp = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'gate-idx-')), 'index');
  const env = { ...process.env, GIT_INDEX_FILE: tmp };
  const g = (args) => spawnSync('git', args, { cwd, encoding: 'utf8', env });
  try {
    if (scope.all) { fs.copyFileSync(path.resolve(cwd, git(['rev-parse', '--git-path', 'index']).stdout.trim()), tmp); g(['add', '-u']); }
    else {
      if (scope.pathspecFile === '-') return null;
      // --only (the default) commits HEAD plus the paths; --include adds them to the index
      if (scope.include) fs.copyFileSync(path.resolve(cwd, git(['rev-parse', '--git-path', 'index']).stdout.trim()), tmp); else g(['read-tree', 'HEAD']);
      if (g(['add', '--', ...scope.paths]).status !== 0) return null;
    }
    return g(['write-tree']).stdout?.trim() || null;
  } catch { return null; } finally { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); }
};
const diff = git(['diff', ...(ALL ? [PARENT] : ['--cached', PARENT]), '--name-status', '-M', '--', 'src/content/docs', 'public']);
const src = makeSource(root, { index: !ALL, prefixes: ['src/content/docs', '_data', 'public'] });
if (diff.status !== 0) process.exit(0);
const isPage = (f) => /\.(md|mdx)$/.test(f) && f.startsWith('src/content/docs/');
const pages = [], retired = [], deletedMedia = [];
const renamedFrom = new Map();
for (const line of diff.stdout.split('\n')) {
  if (!line.trim()) continue;
  const [status, a, b] = line.split('\t');
  const s = status[0];
  if (s === 'D') { if (isPage(a)) retired.push(a); else if (a.startsWith('public/')) deletedMedia.push(a); }
  else if (s === 'R') { if (isPage(a)) retired.push(a); if (isPage(b)) { pages.push(b); if (isPage(a)) renamedFrom.set(b, a); } }
  else if (isPage(a)) pages.push(a);
}
// A merge commit brings the merged-in side's pages along (#1209, 2026-10-27: main's own line-ending
// changes and a main page's missing Next blocked a merge of main). A file whose content equals that
// side's version came from there and is not this commit's change; a conflict resolution differs from
// both sides and is still judged.
const mergeHead = git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']).stdout?.trim();
if (mergeHead) {
  const blob = (spec) => { const r = git(['rev-parse', '-q', '--verify', spec]); return r.status === 0 ? r.stdout.trim() : null; };
  const now = (f) => (ALL ? (fs.existsSync(path.join(root, f)) ? git(['hash-object', '--', f]).stdout?.trim() || null : null) : blob(`:${f}`));
  const fromThem = (f) => now(f) === blob(`${mergeHead}:${f}`);
  for (const list of [pages, retired, deletedMedia]) list.splice(0, list.length, ...list.filter((f) => !fromThem(f)));
}
if (!pages.length && !retired.length && !deletedMedia.length) { logDecision('allow', { scope: ALL ? 'worktree' : 'index', note: 'no docs change' }); process.exit(0); }

const fails = [], warns = [];
// The published base: keboola/main, else origin/main, else main; and where this branch left it.
const baseRef = ['keboola/main', 'origin/main', 'main'].find((r) => git(['rev-parse', '-q', '--verify', r]).status === 0) ?? null;
const mergeBase = baseRef ? (git(['merge-base', 'HEAD', baseRef]).stdout?.trim() || null) : null;
const NEVER_DOWNGRADE = new Set(['D9', 'D16']);
const run = (file, args, extra = {}) => {
  const r = spawnSync(process.execPath, [file, ...args], { cwd: root, encoding: 'utf8', timeout: CHILD_MS, maxBuffer: 64 * 1024 * 1024, ...extra });
  return { ...r, timedOut: r.error?.code === 'ETIMEDOUT' };
};
const timeout = (what) => (mode === 'strict' ? fails : warns).push(`${what} timed out after ${CHILD_MS / 1000} s${mode === 'strict' ? '' : ' (DOCS_GATE=strict to fail on this)'}`);

// ---- 0. line endings: a page whose lines changed only from LF to CRLF (or back) -------------------------
// Two field runs rewrote a mixed-ending page as all CRLF, so the diff showed the frontmatter as changed
// (G2, G5). Compare the change with and without --ignore-cr-at-eol.
const numstat = (extra) => {
  const r = git(['diff', ...(ALL ? [PARENT] : ['--cached', PARENT]), '--numstat', ...extra, '--', ...pages]);
  const m = new Map();
  for (const l of (r.stdout ?? '').split('\n')) { const [a, d, f] = l.split('\t'); if (f && a !== '-') m.set(f, +a + +d); }
  return m;
};
if (pages.length) {
  const plain = numstat([]), noEol = numstat(['--ignore-cr-at-eol']);
  for (const [f, n] of plain) {
    const extra = n - (noEol.get(f) ?? 0);
    if (extra >= 2) fails.push(`${f}: ${Math.floor(extra / 2)} line(s) changed only in their line endings (LF/CRLF): keep the file's endings (edit with Python open(newline=""), check git diff --stat), or stage only the real change with git add -p`);
  }
}

// ---- 1. Diátaxis on staged pages ----------------------------------------------------------------
const existing = pages.filter((p) => src.exists(path.join(root, p)));
if (existing.length) {
  const args = ['--root', root, '--json', ...(ALL ? [] : ['--index']), ...(fs.existsSync(path.join(root, 'dist')) ? ['--dist'] : []), ...existing];
  // What the same pages failed on the merge-base: those rule ids are old debt, not this change.
  const oldFails = new Map();
  if (mergeBase) {
    const onBase = existing.map((p) => [p, renamedFrom.get(p) ?? p]).filter(([, b]) => git(['cat-file', '-e', `${mergeBase}:${b}`]).status === 0);
    if (onBase.length) {
      const rb = run(DIATAXIS, ['--root', root, '--json', '--ref', mergeBase, ...onBase.map(([, b]) => b)]);
      let jb = null; try { jb = JSON.parse(rb.stdout); } catch { /* no baseline: judge strictly */ }
      const back = new Map(onBase.map(([p, b]) => [b, p]));
      for (const p of jb?.pages ?? []) {
        const ids = new Set((p.findings ?? []).filter((f) => f.level === 'FAIL').map((f) => f.id));
        if (back.has(p.file)) oldFails.set(back.get(p.file), ids);
      }
    }
  }
  const r = run(DIATAXIS, args);
  if (r.timedOut) timeout('diataxis check');
  else {
    let j = null; try { j = JSON.parse(r.stdout); } catch { /* fall through */ }
    if (!j) warns.push(`diataxis check gave no JSON (exit ${r.status}): ${(r.stderr || r.stdout).trim().split('\n')[0] || ''}`);
    else for (const p of j.pages ?? []) for (const f of p.findings ?? []) {
      const line = `${p.file}${f.line ? ':' + f.line : ''} ${f.id} ${f.msg}`;
      const old = f.level === 'FAIL' && !NEVER_DOWNGRADE.has(f.id) && oldFails.get(p.file)?.has(f.id);
      if (old) warns.push(`${line} (already on main, not this change: leave it for a form pass)`);
      else if (f.level === 'FAIL') fails.push(line); else if (f.level === 'WARN') warns.push(line);
    }
  }
}

// ---- 2. retired pages need a redirect_from somewhere ------------------------------------------
const slugOf = (f) => '/' + f.replace(/^src\/content\/docs\//, '').replace(/\.(md|mdx)$/, '').replace(/\/index$/, '').replace(/^index$/, '') + '/';
// A page that never reached the published base (keboola/main, else origin/main) has no URL anyone holds:
// dropping it from a branch needs no redirect.
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
    // Its own old URLs must land too: a page deleted by hand dropped /management/limits/ unnoticed (V10).
    const was = baseRef ? git(['show', `${baseRef}:${f}`]) : null;
    const wasFm = was?.status === 0 ? (was.stdout.match(/^---\r?\n([\s\S]*?)\r?\n---/) ?? [])[1] ?? '' : '';
    const own = wasFm.match(/^redirect_from:[ \t]*(\[.*\])?\s*$((?:\r?\n[ \t]+-[ \t]+.*)*)/m);
    const olds = own ? [...(own[1] ?? '').matchAll(/\/[A-Za-z0-9_./-]*/g), ...(own[2] ?? '').matchAll(/\/[A-Za-z0-9_./-]*/g)].map((m) => m[0].replace(/\/?$/, '/')) : [];
    for (const u of olds) if (!claimed.has(u)) fails.push(`${f} retired, and its own old URL ${u} is no longer in any redirect_from (carry it to the target; docs-retire does)`);
  }
  // The nav must not keep pointing at a retired page (no build needed to see it).
  let nav = '';
  try { nav = src.read(path.join(root, '_data', 'navigation.yml')); } catch { /* nav not staged-readable */ }
  for (const f of retired) {
    const slug = slugOf(f).replace(/\/+/g, '/');
    if (new RegExp(`url:\\s*['"]?${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\s*$`, 'm').test(nav)) fails.push(`_data/navigation.yml still lists ${slug}, retired by ${f}: remove or re-point the entry (docs-retire does)`);
  }
}

// ---- 3. media deleted while still referenced ----------------------------------------------------
if ((deletedMedia.length || retired.length) && fs.existsSync(INVENTORY)) {
  const r = run(INVENTORY, ['--root', root, '--json', ...(ALL ? [] : ['--index'])]);
  if (r.timedOut) timeout('media inventory');
  else {
    let j = null; try { j = JSON.parse(r.stdout); } catch { /* fall through */ }
    if (j) {
      const refs = new Map();
      for (const p of j.pages ?? []) for (const m of p.media ?? []) { if (!refs.has(m.resolved)) refs.set(m.resolved, []); refs.get(m.resolved).push(p.page); }
      for (const f of deletedMedia) { const by = refs.get(f); if (by?.length) fails.push(`${f} deleted, but still referenced by ${[...new Set(by)].join(', ')}: restore it (git restore --staged --worktree ${f}) or remove the reference first`); }
      // Only media this commit orphans: files the staged pages referenced before (HEAD) and nobody references now.
      const before = new Set();
      for (const pg of [...pages, ...retired]) {
        const prev = git(['show', `${PARENT}:${pg}`]); if (prev.status !== 0) continue;
        const abs = path.join(root, pg);
        for (const r of pageRefs(abs, prev.stdout, { root, exists: src.exists, docsDir: path.join(root, 'src', 'content', 'docs') }).refs) if (r.resolved.startsWith('public/')) before.add(r.resolved);
      }
      const unref = new Set((j.unreferenced ?? []).map((u) => 'public/' + u));
      for (const o of before) if (unref.has(o) && !deletedMedia.includes(o)) warns.push(`${o} is referenced by no page any more (this commit dropped the last reference; delete it in the same commit, after media-inventory --dist agrees, or keep it on purpose)`);
    }
  }
}

// ---- 4. links, only when a build exists ------------------------------------------------------------
// A dist/ older than the page sources or the nav checks some other tree: a reset after a build left
// a redirect stub there and the gate blocked an unrelated commit (field test 2026-10-15). Then the
// link check still runs, but its blockers are reported as WARN with "rebuild".
const newestSource = () => {
  let t = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (/\.mdx?$/.test(e.name)) t = Math.max(t, fs.statSync(f).mtimeMs);
  } };
  try { walk(path.join(root, 'src', 'content', 'docs')); t = Math.max(t, fs.statSync(path.join(root, '_data', 'navigation.yml')).mtimeMs); } catch { /* partial checkout */ }
  return t;
};
if (fs.existsSync(path.join(root, 'dist')) && fs.existsSync(path.join(root, 'scripts', 'convert-nav.mjs'))) {
  const base = baseRef ? ['--base', baseRef] : [];
  let built = 0;
  try { built = fs.statSync(path.join(root, 'dist', 'index.html')).mtimeMs; } catch { /* no index page */ }
  const stale = built && newestSource() > built;
  const r = run(LINKS, [...base, '--no-build-check']);
  if (r.timedOut) timeout('link check');
  else if (r.status === 1 && stale) {
    for (const l of r.stdout.split('\n')) if (/^✗ /.test(l) && !/blocker\(s\)/.test(l)) warns.push('links (dist/ is older than the sources, rebuild to confirm): ' + l.replace(/^✗ /, ''));
  } else if (r.status === 1) {
    for (const l of r.stdout.split('\n')) if (/^✗ /.test(l) && !/blocker\(s\)/.test(l)) fails.push('links: ' + l.replace(/^✗ /, ''));
    if (!fails.some((l) => l.startsWith('links:'))) fails.push('links: link & redirect check reported blockers');
  } else if (r.status === 2) warns.push(`link check skipped: ${(r.stderr || '').trim().split('\n')[0]}`);
} else warns.push('no dist/ (or no scripts/convert-nav.mjs): link check skipped; `npm run build` then re-run docs-link-redirect-check');

// ---- verdict ----------------------------------------------------------------------------------------
const cut = (arr) => (arr.length > MAX_LINES ? [...arr.slice(0, MAX_LINES), `+${arr.length - MAX_LINES} more`] : arr);
const n = (x, w) => `${x} ${w}${x === 1 ? '' : 's'}`;
const scopeName = ALL ? 'worktree' : 'index';
if (fails.length) {
  const files = new Set(fails.map((l) => (l.startsWith('links:') ? 'links' : l.split(/[:\s]/)[0])));
  const reason = [`docs gate: ${n(fails.length, 'FAIL')} in ${n(files.size, 'file')}`, ...cut(fails).map((l) => '  ' + l),
    ...(warns.length ? ['Also (not blocking):', ...cut(warns).map((l) => '  ' + l)] : []),
    'Fix the FAILs, re-run docs-diataxis-check (and docs-link-redirect-check), stage, then commit in a separate call. DOCS_GATE=skip git commit … bypasses the gate (say so in the PR).'].join('\n');
  logDecision('deny', { scope: scopeName, fails: fails.length, warns: warns.length });
  out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
  process.exit(0);
}
const summary = `docs gate: ✓ ${n(pages.length, 'page')} · 0 fail · ${n(warns.length, 'warn')}`;
logDecision('allow', { scope: scopeName, fails: 0, warns: warns.length });
out({ systemMessage: summary, hookSpecificOutput: { hookEventName: 'PreToolUse',
  additionalContext: [summary, ...(warns.length ? ['warnings (not blocking):', ...cut(warns).map((l) => '  ' + l)] : [])].join('\n') } });
process.exit(0);
