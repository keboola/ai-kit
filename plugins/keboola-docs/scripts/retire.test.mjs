// retire.test.mjs — node --test <plugin>/scripts/retire.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'retire.mjs');
const FIXTURE = path.join(HERE, '..', 'skills', 'docs-diataxis-check', 'scripts', 'fixtures', 'repo');
const repo = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'retire-')); fs.cpSync(FIXTURE, d, { recursive: true }); fs.rmSync(path.join(d, 'dist'), { recursive: true, force: true }); return d; };
const run = (dir, ...a) => { const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json', ...a], { encoding: 'utf8' }); return { status: r.status, stderr: r.stderr, out: r.stdout ? JSON.parse(r.stdout) : null }; };
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const DOC = 'src/content/docs/guide/';

test('delete: redirect added to the target, nav entry removed, inbound links rewritten, page gone', () => {
  const dir = repo();
  // give the retired page its own redirect, to prove it is carried over (no chains)
  const sn = path.join(dir, DOC, 'skip-next.md');
  fs.writeFileSync(sn, read(dir, DOC + 'skip-next.md').replace("slug: 'guide/skip-next'", "slug: 'guide/skip-next'\nredirect_from:\n  - /guide/very-old/"));
  const { status, out } = run(dir, '--from', 'guide/skip-next', '--to', 'guide/clean-howto');
  assert.equal(status, 0);
  assert.deepEqual(out.redirectsAdded, ['/guide/skip-next/', '/guide/very-old/']);
  assert.match(read(dir, DOC + 'clean-howto.md'), /redirect_from:\n  - \/guide\/skip-next\/\n  - \/guide\/very-old\/\n/);
  assert.ok(!fs.existsSync(sn), 'retired page deleted');
  assert.equal(out.navChanged, true);
  assert.ok(!read(dir, '_data/navigation.yml').includes('/guide/skip-next/'));
  assert.ok(!read(dir, '_data/navigation.yml').includes('Skips a sibling'), 'the title line under the url went too');
  assert.ok(read(dir, '_data/navigation.yml').includes('/guide/broken-next/'), 'the sibling before it stayed');
  const idx = read(dir, DOC + 'index.md');
  assert.ok(idx.includes('](/guide/clean-howto/)') && !idx.includes('/guide/skip-next/'), 'inbound link in the overview rewritten');
  assert.ok(out.linksRewritten.some((l) => l.file.endsWith('guide/index.md')));
});

test('merge: body appended under a TEMPLATE note before Next; dry run writes nothing', () => {
  const dir = repo();
  const before = read(dir, DOC + 'clean-howto.md');
  const dry = run(dir, '--from', 'guide/no-desc', '--to', 'guide/clean-howto', '--merge', '--dry-run');
  assert.equal(dry.out.dryRun, true);
  assert.equal(read(dir, DOC + 'clean-howto.md'), before);
  assert.ok(fs.existsSync(path.join(dir, DOC, 'no-desc.md')));
  const { out } = run(dir, '--from', 'guide/no-desc', '--to', 'guide/clean-howto', '--merge');
  assert.equal(out.mode, 'merge');
  const after = read(dir, DOC + 'clean-howto.md');
  assert.match(after, /<!-- TEMPLATE: folded in from \/guide\/no-desc\/ by docs-retire/);
  assert.ok(after.indexOf('TEMPLATE: folded') < after.indexOf('**Next:**'), 'the folded block sits before the Next footer');
  assert.ok(!fs.existsSync(path.join(dir, DOC, 'no-desc.md')));
});

test('rename: file moves, slug updated, old url in redirect_from, nav url re-pointed', () => {
  const dir = repo();
  const { status, out, stderr } = run(dir, '--from', 'guide/plugin-word', '--rename', 'guide/plugin-vocabulary');
  assert.equal(status, 0, stderr);
  assert.equal(out.mode, 'rename');
  const moved = read(dir, DOC + 'plugin-vocabulary.md');
  assert.match(moved, /^slug: 'guide\/plugin-vocabulary'$/m);
  assert.match(moved, /redirect_from:\n  - \/guide\/plugin-word\//);
  assert.ok(!fs.existsSync(path.join(dir, DOC, 'plugin-word.md')));
  assert.ok(read(dir, '_data/navigation.yml').includes('/guide/plugin-vocabulary/'));
});

test('refuses a missing source, a missing target and from == to', () => {
  const dir = repo();
  assert.equal(run(dir, '--from', 'guide/nope', '--to', 'guide/clean-howto').status, 2);
  assert.equal(run(dir, '--from', 'guide/no-desc', '--to', 'guide/nope').status, 2);
  assert.equal(run(dir, '--from', 'guide/no-desc', '--to', 'guide/no-desc').status, 2);
});
