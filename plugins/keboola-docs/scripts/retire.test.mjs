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

test('merge into a page with Limits and no Next: folded as its own section before Limits; self-links go to it', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, DOC, 'ref-target.md'), "---\ntitle: Reference target\nslug: 'guide/ref-target'\nredirect_from:\n    - /guide/ancient/\n---\n\nLede. See [the extra page](/guide/extra/).\n\n## Fields\n\nA table.\n\n## Limits\n\nTen per day.\n");
  fs.writeFileSync(path.join(dir, DOC, 'extra.md'), "---\ntitle: Extra settings\nslug: 'guide/extra'\n---\n\nExtra lede.\n\n## Option\n\nText.\n");
  const { status, out } = run(dir, '--from', 'guide/extra', '--to', 'guide/ref-target', '--merge');
  assert.equal(status, 0);
  const t = read(dir, DOC + 'ref-target.md');
  assert.ok(t.indexOf('## Extra settings') > 0 && t.indexOf('## Extra settings') < t.indexOf('## Limits'), 'folded before Limits');
  assert.match(t, /\[the extra page\]\(#extra-settings\)/, 'the self-link points at the folded section');
  assert.match(t, /redirect_from:\n    - \/guide\/ancient\/\n    - \/guide\/extra\/\n/, 'existing lines kept, new one in their indent');
  assert.deepEqual(out.redirectsAdded, ['/guide/extra/']);
});

test('rename keeps the moved page media out of the orphan list', () => {
  const dir = repo();
  fs.mkdirSync(path.join(dir, 'public', 'guide'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'only-here.png'), 'x');
  const p = path.join(dir, DOC, 'skip-next.md');
  fs.writeFileSync(p, read(dir, DOC + 'skip-next.md').replace(/\n## /, '\n![Shot](/guide/only-here.png)\n\n## '));
  const { status, out } = run(dir, '--from', 'guide/skip-next', '--rename', 'guide/skip-renamed');
  assert.equal(status, 0);
  assert.deepEqual(out.orphanMedia, []);
  assert.ok(fs.existsSync(path.join(dir, 'public', 'guide', 'only-here.png')));
});

test('links without the trailing slash are rewritten too', () => {
  const dir = repo();
  fs.appendFileSync(path.join(dir, DOC, 'last.md'), '\nSee [skip](/guide/skip-next) and [anchor](/guide/skip-next#x).\n');
  const { status } = run(dir, '--from', 'guide/skip-next', '--to', 'guide/clean-howto');
  assert.equal(status, 0);
  const t = read(dir, DOC + 'last.md');
  assert.ok(t.includes('(/guide/clean-howto/)') && t.includes('(/guide/clean-howto/#x)') && !t.includes('/guide/skip-next'));
});

test('merge keeps a CRLF target CRLF and folds into the section the target already has', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, DOC, 'parent.md'), "---\ntitle: Parent\nslug: 'guide/parent'\n---\n\r\nLede.\r\n\r\n## 2 Extra settings\r\n\r\nShort summary.\r\n\r\n## 3 Other\r\n\r\nText.\r\n");
  fs.writeFileSync(path.join(dir, DOC, 'extra.md'), "---\ntitle: Extra settings\nslug: 'guide/extra'\n---\n\nThe long version.\n");
  const { status, out } = run(dir, '--from', 'guide/extra', '--to', 'guide/parent', '--merge');
  assert.equal(status, 0);
  const t = read(dir, DOC + 'parent.md');
  assert.equal(out.foldedInto, '## 2 Extra settings');
  assert.equal((t.match(/Extra settings/g) ?? []).length, 1, 'no second heading');
  assert.ok(t.indexOf('The long version.') > t.indexOf('Short summary.') && t.indexOf('The long version.') < t.indexOf('## 3 Other'));
  const body = t.split('---\n').slice(2).join('---\n');
  assert.ok(!/[^\r]\n/.test(body.slice(1)), 'every body line ends in CRLF');
});

test('rename moves the media under the old URL and rewrites their references', () => {
  const dir = repo();
  fs.mkdirSync(path.join(dir, 'public', 'guide', 'skip-next'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'skip-next', 'shot.png'), 'x');
  const p = path.join(dir, DOC, 'skip-next.md');
  fs.writeFileSync(p, read(dir, DOC + 'skip-next.md').replace(/\n## /, '\n![Shot](/guide/skip-next/shot.png)\n\n## '));
  const { status, out } = run(dir, '--from', 'guide/skip-next', '--rename', 'guide/skip-renamed');
  assert.equal(status, 0);
  assert.ok(fs.existsSync(path.join(dir, 'public', 'guide', 'skip-renamed', 'shot.png')));
  assert.ok(!fs.existsSync(path.join(dir, 'public', 'guide', 'skip-next', 'shot.png')));
  assert.match(read(dir, DOC + 'skip-renamed.md'), /\(\/guide\/skip-renamed\/shot\.png\)/);
  assert.deepEqual(out.orphanMedia, []);
});
