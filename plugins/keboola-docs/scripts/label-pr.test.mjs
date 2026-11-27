// Tests for docs-pr-label's --preview mode (no gh calls, no PR needed). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'docs-pr-label', 'scripts', 'label-pr.mjs');
const preview = (...a) => {
  const r = spawnSync(process.execPath, [SCRIPT, '--preview', ...a], { encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.split('\n')[0];
};

test('--preview labels by ticket, by file share and by touched tooling, without gh', () => {
  assert.equal(preview('--title', 'PRDCT-487: hub', '--branch', 'x', '--files', 'src/content/docs/a.md'), 'would label: getting-started (getting-started: ticket)');
  assert.match(preview('--title', 'x', '--branch', 'y', '--files', 'scripts/a.mjs,src/content/docs/b.md'), /site-tooling/);
  assert.equal(preview('--title', 'Storage: load csv', '--branch', 'z', '--files', 'src/content/docs/storage/tables/load-csv.mdx'), 'would label: nothing (no rule matched)');
});
