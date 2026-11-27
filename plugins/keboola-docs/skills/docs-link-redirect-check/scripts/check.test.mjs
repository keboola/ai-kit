// check.test.mjs — node --test <plugin>/skills/docs-link-redirect-check/scripts/check.test.mjs
// A two-page repo with a hand-written dist/: page a links into page b's anchors, then b changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check.mjs');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (dir, ...a) => { const r = spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: ENV }); assert.equal(r.status, 0, r.stderr); };
const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const page = (slug) => `---\ntitle: ${slug}\nslug: '${slug}'\ndescription: 'x'\n---\n\nText.\n`;
const html = (body) => `<html><body><main>${body}</main></body></html>`;

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkcheck-'));
  write(dir, 'src/content/docs/a.md', page('a'));
  write(dir, 'src/content/docs/b.md', page('b'));
  write(dir, '_data/navigation.yml', '- url: /a/\n  title: A\n- url: /b/\n  title: B\n');
  git(dir, 'init', '-q', '-b', 'main'); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'split');
  return dir;
}
const run = (dir) => spawnSync(process.execPath, [CHECK, '--base', 'main', '--no-build-check'], { cwd: dir, encoding: 'utf8' });

test('a link from an unchanged page to an anchor the changed page dropped is a blocker', () => {
  const dir = repo();
  fs.appendFileSync(path.join(dir, 'src/content/docs/b.md'), '\nChanged.\n');
  write(dir, 'dist/a/index.html', html('<a href="/b/#kept">k</a> <a href="https://help.keboola.com/b/#gone">g</a>'));
  write(dir, 'dist/b/index.html', html('<h2 id="kept">Kept</h2>'));
  write(dir, 'dist/index.html', html(''));
  const r = run(dir);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /BROKEN ANCHOR[\s\S]*\/a\/\s+→\s+\/b\/#gone\s+\(into a changed page\)/);
  assert.doesNotMatch(r.stdout, /#kept/);
});

test('with the anchor in place the check passes', () => {
  const dir = repo();
  fs.appendFileSync(path.join(dir, 'src/content/docs/b.md'), '\nChanged.\n');
  write(dir, 'dist/a/index.html', html('<a href="/b/#kept">k</a>'));
  write(dir, 'dist/b/index.html', html('<h2 id="kept">Kept</h2>'));
  write(dir, 'dist/index.html', html(''));
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout);
});
