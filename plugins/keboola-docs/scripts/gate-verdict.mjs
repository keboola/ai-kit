#!/usr/bin/env node
// gate-verdict.mjs: what the commit gate decided about the tree HEAD records. docs-ship runs it
// before a push.
//
//   node <plugin>/scripts/gate-verdict.mjs [<repo dir>] [--json]
//
// The gate appends every decision to gate-log.jsonl in the plugin's data directory, and that
// directory depends on how the plugin was loaded: `keboola-docs-<marketplace>` when installed,
// `keboola-docs-inline` in a session that loads it inline (human test, 2026-10-21: the testers' entries
// were in one, docs-ship looked in the other). This reads every `keboola-docs-*` log under
// ~/.claude/plugins/data (and $CLAUDE_PLUGIN_DATA) and prints the newest entry for HEAD^{tree}.
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

const base = path.join(os.homedir(), '.claude', 'plugins', 'data');
const logs = new Set();
if (process.env.CLAUDE_PLUGIN_DATA) logs.add(path.join(process.env.CLAUDE_PLUGIN_DATA, 'gate-log.jsonl'));
if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) if (d.startsWith('keboola-docs-')) logs.add(path.join(base, d, 'gate-log.jsonl'));

let best = null;
for (const log of logs) {
  if (!fs.existsSync(log)) continue;
  for (const line of fs.readFileSync(log, 'utf8').split('\n')) {
    if (!line.includes(tree)) continue;
    try {
      const e = JSON.parse(line);
      if (e.tree === tree && (!best || e.at > best.at)) best = { ...e, log };
    } catch { /* a torn line */ }
  }
}

const verdict = best ? best.decision : 'none';
if (JSON_OUT) console.log(JSON.stringify({ repo, tree, verdict, entry: best }, null, 2));
else if (!best) console.log(`✗ no gate entry for HEAD^{tree} ${tree.slice(0, 9)} in ${[...logs].length} log(s): the commit bypassed the gate; re-run it (git commit --amend --no-edit)`);
else console.log(`${verdict === 'allow' ? '✓' : '✗'} gate ${verdict} for ${tree.slice(0, 9)} at ${best.at} (${best.fails ?? 0} fail, ${best.warns ?? 0} warn) · ${best.log}`);
process.exit(verdict === 'allow' ? 0 : verdict === 'skip' ? 3 : 1);
