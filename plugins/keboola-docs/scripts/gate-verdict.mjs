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
// (DOCS_GATE=skip: name the skipped checks and get the author's ok again).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

let best = null;
for (const log of logs) {
  if (!fs.existsSync(log)) continue;
  for (const line of fs.readFileSync(log, 'utf8').split('\n')) {
    if (!line.includes(tree)) continue;
    try {
      const e = JSON.parse(line);
      if (e.tree === tree && (log === own || ofThisRepo(e)) && (!best || e.at > best.at)) best = { ...e, log };
    } catch { /* a torn line */ }
  }
}

const verdict = best ? best.decision : 'none';
if (JSON_OUT) console.log(JSON.stringify({ repo, tree, verdict, entry: best }, null, 2));
else if (!best) console.log(`✗ no gate entry for HEAD^{tree} ${tree.slice(0, 9)} in ${[...logs].length} log(s): the commit bypassed the gate; re-run it (git commit --amend --no-edit)`);
else console.log(`${verdict === 'allow' ? '✓' : '✗'} gate ${verdict} for ${tree.slice(0, 9)} at ${best.at} (${best.fails ?? 0} fail, ${best.warns ?? 0} warn) · ${best.log}`);
process.exit(verdict === 'allow' ? 0 : verdict === 'skip' ? 3 : 1);
