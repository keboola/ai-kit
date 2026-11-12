#!/usr/bin/env node
// pr-before-after.mjs: PostToolUse(Bash) hook. After `gh pr create` or `git push` in a
// keboola/connection-docs worktree whose branch has an open PR, it renders the before/after report
// (scripts/before-after.mjs: live site vs local build, screenshots of every changed spot) and tells
// Claude to publish it as an Artifact, so the author gets the link without asking.
//
// WHY: Nikita asked (2026-11-12) for the report on every PR with visual changes, so no PR needs a
// manual page-by-page check. A hook cannot publish an Artifact itself; it writes the file and hands
// Claude the path in additionalContext.
//
// Silent when: the command is anything else or failed; no docs checkout; branch main/master; no open
// PR for the branch; no changed page under src/content/docs; the report already covers this HEAD;
// the report finds no rendered change. Says why it skipped when another astro build is running
// (shared node_modules) or the run failed.
// Escape hatch: DOCS_BEFORE_AFTER=skip (env or command prefix).
// Report: <worktree>/.before-after/before-after.html (kept out of git via info/exclude).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { segments } from './lib/shell.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const say = (msg) => { process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: msg } })); process.exit(0); };

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
if (input.tool_name !== 'Bash' || (process.env.DOCS_BEFORE_AFTER || '').toLowerCase() === 'skip') process.exit(0);
const cmd = String(input.tool_input?.command ?? '');
const segs = segments(cmd);
const ti = segs.findIndex((sg) => sg.git?.sub === 'push' || (sg.argv[0] === 'gh' && sg.argv[1] === 'pr' && sg.argv[2] === 'create'));
if (ti < 0) process.exit(0);
if (segs.slice(0, ti + 1).some((sg) => sg.env?.DOCS_BEFORE_AFTER === 'skip')) process.exit(0);

// the command must have worked
const resp = input.tool_response ?? {};
const respText = JSON.stringify(resp);
if (resp.interrupted || /! \[rejected\]|\bfatal: |error: failed to push|Exit code [1-9]/.test(respText)) process.exit(0);

// follow `cd <dir> &&` and `git -C <dir>` like the commit gate does
const home = process.env.HOME || '';
let cwd = input.cwd || process.cwd();
for (const sg of segs.slice(0, ti)) {
  if ((sg.argv[0] === 'cd' || sg.argv[0] === 'pushd') && sg.argv.length <= 2) {
    const to = (sg.argv[1] ?? home).replace(/^~(?=\/|$)/, home);
    if (to !== '-') cwd = path.resolve(cwd, to);
  }
}
if (segs[ti].git?.C) cwd = path.resolve(cwd, segs[ti].git.C);
const run = (bin, args, opts = {}) => spawnSync(bin, args, { cwd, encoding: 'utf8', ...opts });
const git = (...a) => { const r = run('git', a); return r.status === 0 ? r.stdout.trim() : null; };

const root = git('rev-parse', '--show-toplevel');
if (!root || !fs.existsSync(path.join(root, 'src', 'content', 'docs')) || !fs.existsSync(path.join(root, '_data', 'navigation.yml'))) process.exit(0);
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (!branch || branch === 'HEAD' || branch === 'main' || branch === 'master') process.exit(0);

// the open PR: from gh pr create's output, else ask gh for the branch's PR
let pr = (respText.match(/https:\/\/github\.com\/keboola\/connection-docs\/pull\/(\d+)/g) || []).pop()?.split('/').pop();
if (!pr) {
  const r = run('gh', ['pr', 'view', branch, '--repo', 'keboola/connection-docs', '--json', 'number,state', '-q', 'select(.state=="OPEN") | .number'], { timeout: 20000 });
  pr = r.status === 0 ? r.stdout.trim() : '';
}
if (!pr) process.exit(0);

// pages changed against main (the live site is main, so a stacked PR shows everything readers will see)
const base = ['keboola/main', 'origin/main'].find((b) => git('rev-parse', '--verify', '--quiet', b));
if (!base) process.exit(0);
const changed = (git('diff', '--name-only', `${base}...HEAD`, '--', 'src/content/docs') || '').split('\n').filter((f) => /\.mdx?$/.test(f));
if (!changed.length) process.exit(0);

const head = git('rev-parse', 'HEAD');
const outDir = path.join(root, '.before-after');
const stamp = path.join(outDir, 'head.txt');
if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8').trim() === head) process.exit(0);

// keep the report out of git for every worktree of this repo
const common = git('rev-parse', '--git-common-dir');
if (common) {
  const ex = path.join(path.resolve(root, common), 'info', 'exclude');
  try {
    const cur = fs.existsSync(ex) ? fs.readFileSync(ex, 'utf8') : '';
    if (!cur.split('\n').includes('.before-after/')) { fs.mkdirSync(path.dirname(ex), { recursive: true }); fs.appendFileSync(ex, `${cur.endsWith('\n') || !cur ? '' : '\n'}.before-after/\n`); }
  } catch { /* convenience only */ }
}

const busy = run('pgrep', ['-f', 'astro build']).stdout?.trim();
if (busy) say(`docs-before-after (hook): skipped the report for PR #${pr}: another \`astro build\` is running and the worktrees share node_modules. When it finishes, run the docs-before-after skill on ${root}.`);

const r = run('node', [path.join(HERE, 'before-after.mjs'), '--root', root, '--base', base, '--build', '--title', `PR #${pr} review`, '--out', outDir], { timeout: 280000, maxBuffer: 32 << 20 });
const file = (r.stdout || '').trim().split('\n').pop();
const summary = (r.stderr || '').split('\n').reverse().find((l) => / visible · /.test(l)) || '';
if (r.status !== 0 || !file || !fs.existsSync(file)) {
  const why = r.error?.code === 'ETIMEDOUT' ? 'timed out after 280 s' : ((r.stderr || '').trim().split('\n').slice(-3).join(' / ') || `exit ${r.status}`);
  say(`docs-before-after (hook): the report for PR #${pr} failed (${why}). Run the docs-before-after skill on ${root} by hand.`);
}
fs.writeFileSync(stamp, head + '\n');
const m = summary.match(/(\d+) pages? · (\d+) visible · (\d+) cosmetic · ([\d.]+) MB/);
const [pages, vis, cos, mb] = m ? m.slice(1) : ['?', '?', '?', '?'];
if (m && Number(vis) + Number(cos) === 0) process.exit(0);

say(`docs-before-after (hook): before/after report for PR #${pr} (${branch} at ${head.slice(0, 9)}): ${vis} visible and ${cos} case/punctuation changes on ${pages} page(s), ${mb} MB.
Publish it now with the Artifact tool: file_path ${file}. On the first publish pass icon "compare" and a one-sentence description; publishing the same path again keeps the link. Then give the author the link and the counts. The report is private to the author; don't put its link in the PR.`);
