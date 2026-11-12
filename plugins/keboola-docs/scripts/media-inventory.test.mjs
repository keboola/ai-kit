// media-inventory.test.mjs — node --test <plugin>/scripts/media-inventory.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'media-inventory.mjs');
const FIXTURE = path.join(HERE, '..', 'skills', 'docs-diataxis-check', 'scripts', 'fixtures', 'repo');

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-inv-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'public', 'guide'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'pic.png'), '');
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'orphan.png'), '');
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'clip.mp4'), '');
  const page = path.join(dir, 'src', 'content', 'docs', 'guide', 'clean-howto.md');
  fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace('**Next:**', '![The guide](/guide/pic.png)\n\n<video autoplay loop muted playsinline src="/guide/clip.mp4" poster="/guide/clip-poster.png" aria-label="Guide running"></video>\n\n**Next:**'));
  return dir;
}
const run = (dir, ...a) => { const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json', ...a], { encoding: 'utf8' }); return { status: r.status, out: JSON.parse(r.stdout) }; };

test('lists image, video and poster refs with existence and who references them', () => {
  const dir = repo();
  const { status, out } = run(dir, 'src/content/docs/guide/clean-howto.md');
  assert.equal(out.pages.length, 1);
  const m = Object.fromEntries(out.pages[0].media.map((x) => [x.path, x]));
  assert.equal(m['/guide/pic.png'].kind, 'image'); assert.equal(m['/guide/pic.png'].exists, true); assert.equal(m['/guide/pic.png'].alt, 'The guide');
  assert.equal(m['/guide/clip.mp4'].kind, 'video'); assert.equal(m['/guide/clip.mp4'].exists, true);
  assert.equal(m['/guide/clip-poster.png'].kind, 'poster'); assert.equal(m['/guide/clip-poster.png'].exists, false);
  assert.deepEqual(m['/guide/pic.png'].referencedBy, ['src/content/docs/guide/clean-howto.md']);
  assert.equal(status, 1, 'a missing poster makes the exit code 1');
});

test('unreferenced media under public/ is listed site-wide even when one page is selected', () => {
  const dir = repo();
  const { out } = run(dir, 'src/content/docs/guide/no-desc.md');
  assert.deepEqual(out.pages[0].media, []);
  assert.deepEqual(out.unreferenced, ['guide/orphan.png']);
});

const page = (dir) => path.join(dir, 'src', 'content', 'docs', 'guide', 'clean-howto.md');
const addBeforeNext = (dir, snippet) => { const p = page(dir); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('**Next:**', `${snippet}\n\n**Next:**`)); };

test('a relative <img> keeps its public/ file alive; a colocated image does not keep a public copy alive', () => {
  const dir = repo();
  fs.mkdirSync(path.join(dir, 'public', 'guide', 'clean-howto'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'clean-howto', 'raw.png'), '');
  fs.writeFileSync(path.join(dir, 'src', 'content', 'docs', 'guide', 'near.png'), '');
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'near.png'), '');          // a stale public twin of the colocated one
  addBeforeNext(dir, '<img src="raw.png" alt="raw">\n\n![near](near.png)');
  const { out } = run(dir, 'src/content/docs/guide/clean-howto.md');
  const m = Object.fromEntries(out.pages[0].media.map((x) => [x.raw, x]));
  assert.equal(m['raw.png'].via, 'public');
  assert.equal(m['raw.png'].resolved, 'public/guide/clean-howto/raw.png');
  assert.equal(m['near.png'].via, 'colocated');
  assert.ok(!out.unreferenced.includes('guide/clean-howto/raw.png'));
  assert.ok(out.unreferenced.includes('guide/near.png'), 'the public copy of a colocated image is an orphan');
});

test('--dist: a public file used only by built HTML counts as referenced', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'only-in-html.png'), '');
  fs.mkdirSync(path.join(dir, 'dist', 'guide', 'clean-howto'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dist', 'guide', 'clean-howto', 'index.html'), '<p><img src="../only-in-html.png"></p>');
  const before = run(dir).out;
  assert.ok(before.unreferenced.includes('guide/only-in-html.png'), 'page sources alone miss it');
  const after = run(dir, '--dist').out;
  assert.equal(after.unreferencedFrom, 'dist');
  assert.ok(!after.unreferenced.includes('guide/only-in-html.png'));
  assert.ok(after.unreferenced.includes('guide/orphan.png'));
});

test('--index reads what is staged, not the working tree', () => {
  const dir = repo();
  const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  g('init', '-q'); g('add', '-A'); g('commit', '-q', '-m', 'base');
  addBeforeNext(dir, '![late](/guide/orphan.png)');                            // unstaged edit
  assert.ok(!run(dir).out.unreferenced.includes('guide/orphan.png'), 'the working tree sees the new ref');
  const idx = run(dir, '--index').out;
  assert.equal(idx.source, 'index');
  assert.ok(idx.unreferenced.includes('guide/orphan.png'), 'the index does not');
});

test('--twins lists byte-identical tracked media under src and public', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'pic.png'), 'same bytes');
  fs.writeFileSync(path.join(dir, 'src', 'content', 'docs', 'guide', 'pic.png'), 'same bytes');
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'other.png'), 'other bytes');
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'other-copy.png'), 'other bytes');
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  spawnSync('git', ['init', '-q'], { cwd: dir, env }); spawnSync('git', ['add', '-A'], { cwd: dir, env });
  const { out } = run(dir, '--twins', 'src/content/docs/guide/clean-howto.md');
  assert.ok(out.twins.some((g) => g.join() === 'public/guide/pic.png,src/content/docs/guide/pic.png'));
  assert.ok(!out.twins.some((g) => g.includes('public/guide/other.png')), 'only sets holding the page\'s own media');
  const all = run(dir, '--twins', '--all', 'src/content/docs/guide/clean-howto.md').out;
  assert.ok(all.twins.some((g) => g.includes('public/guide/other.png')), '--all lists every set');
});
