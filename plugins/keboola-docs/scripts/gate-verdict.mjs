#!/usr/bin/env node
// gate-verdict.mjs: what the commit gate decided about the tree HEAD records. docs-ship runs it
// before a push.
//
//   node <plugin>/scripts/gate-verdict.mjs [<repo dir>] [--json]
//
// The gate appends every decision to <git common dir>/keboola-docs/gate-log.jsonl, which every worktree of
// the repo shares. Older entries live only in the plugin's data directory, which depends on how the
// plugin was loaded (`keboola-docs-<marketplace>`, `keboola-docs-inline`: human test, 2026-10-21), so those
// logs are read too, keeping only entries whose repo is a worktree of this one. A tree id alone is
// not enough: two clones can hold the same tree.
//
// Exit 0: allow. Exit 1: deny, or no entry (the commit bypassed the gate: re-run the checks, e.g.
// `git commit --amend --no-edit`, which the gate judges against HEAD's parent). Exit 3: skip
// (DOCS_GATE=skip: name the skipped checks and get the author's ok again), or a page the gate let
// through as a verbatim move (section-rework's first split commit) still fails D1, D3 or D5 at HEAD:
// the rewrite commit is missing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const repo = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
const tree = spawnSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repo, encoding: 'utf8' }).stdout?.trim();
if (!tree) { console.error(`✗ ${repo} is not a git checkout with a HEAD`); process.exit(2); }

const git = (a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' }).stdout?.trim() ?? '';
const own = path.join(path.resolve(repo, git(['rev-parse', '--git-common-dir'])), 'keboola-docs', 'gate-log.jsonl');
const worktrees = new Set(git(['worktree', 'list', '--porcelain']).split('\n')
  .filter((l) => l.startsWith('worktree ')).map((l) => fs.realpathSync.native(l.slice(9))));
const base = path.join(os.homedir(), '.claude', 'plugins', 'data');
const logs = new Set([own]);
if (process.env.CLAUDE_PLUGIN_DATA) logs.add(path.join(process.env.CLAUDE_PLUGIN_DATA, 'gate-log.jsonl'));
if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) if (d.startsWith('keboola-docs-')) logs.add(path.join(base, d, 'gate-log.jsonl'));
const ofThisRepo = (e) => { try { return worktrees.has(fs.realpathSync.native(e.repo)); } catch { return false; } };

// The trees of this branch's own commits: a verbatim move earlier on the branch must be rewritten by HEAD.
const baseRef = ['keboola/main', 'origin/main', 'main'].find((r) => spawnSync('git', ['rev-parse', '-q', '--verify', r], { cwd: repo }).status === 0);
const mb = baseRef ? git(['merge-base', 'HEAD', baseRef]) : '';
// HEAD's own tree is always in: with no commits of its own past the merge-base the range is empty.
const branchTrees = new Set([tree, ...(mb ? git(['log', '--format=%T', `${mb}..HEAD`]).split('\n').filter(Boolean) : [])]);

let best = null;
const deferredPages = new Set();
for (const log of logs) {
  if (!fs.existsSync(log)) continue;
  for (const line of fs.readFileSync(log, 'utf8').split('\n')) {
    // Cheap prefilter before JSON.parse: the logs only grow.
    if (!line.trim() || ![...branchTrees].some((t) => line.includes(t))) continue;
    try {
      const e = JSON.parse(line);
      if (!branchTrees.has(e.tree) || !(log === own || ofThisRepo(e))) continue;
      for (const pg of e.deferred ?? []) deferredPages.add(pg);
      if (e.tree === tree && (!best || e.at > best.at)) best = { ...e, log };
    } catch { /* a torn line */ }
  }
}

// Verbatim-moved pages: what does HEAD say about their form?
const unformed = [];
if (deferredPages.size) {
  // fileURLToPath, not URL.pathname: a plugin under "Application Support" has a %20 in the pathname.
  const check = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'docs-diataxis-check', 'scripts', 'check.mjs');
  const live = [...deferredPages].filter((pg) => spawnSync('git', ['cat-file', '-e', `HEAD:${pg}`], { cwd: repo }).status === 0);
  const r = live.length ? spawnSync(process.execPath, [check, '--root', repo, '--json', '--ref', 'HEAD', ...live], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) : null;
  let j = null; try { j = r && JSON.parse(r.stdout); } catch { /* no JSON: say so below */ }
  if (r && !j) unformed.push(`diataxis check gave no JSON for ${live.join(', ')}`);
  for (const pg of j?.pages ?? []) for (const f of pg.findings ?? []) if (f.level === 'FAIL' && ['D1', 'D3', 'D5'].includes(f.id)) unformed.push(`${pg.file} ${f.id} ${f.msg}`);
}

let verdict = best ? best.decision : 'none';
if (verdict === 'allow' && unformed.length) verdict = 'unformed';
if (JSON_OUT) console.log(JSON.stringify({ repo, tree, verdict, entry: best, unformed }, null, 2));
else if (!best) console.log(`✗ no gate entry for HEAD^{tree} ${tree.slice(0, 9)} in ${[...logs].length} log(s): the commit bypassed the gate; re-run it (git commit --amend --no-edit)`);
else if (verdict === 'unformed') console.log([`✗ gate allow for ${tree.slice(0, 9)}, but pages the gate let through as a verbatim move still lack their form (the rewrite commit is missing):`, ...unformed.map((u) => '  ' + u)].join('\n'));
else console.log(`${verdict === 'allow' ? '✓' : '✗'} gate ${verdict} for ${tree.slice(0, 9)} at ${best.at} (${best.fails ?? 0} fail, ${best.warns ?? 0} warn) · ${best.log}`);
process.exit(verdict === 'allow' ? 0 : verdict === 'skip' || verdict === 'unformed' ? 3 : 1);
