// repoint-anchors.test.mjs — node --test <plugin>/scripts/repoint-anchors.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'repoint-anchors.mjs');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (dir, ...a) => { const r = spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: ENV }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const fm = (slug) => `---\ntitle: T\nslug: '${slug}'\ndescription: 'x'\n---\n\nLede.\n\n`;

function split() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repoint-'));
  write(dir, 'src/content/docs/tables/index.md', fm('tables') + '## Aliases\n\na\n\n## Primary keys\n\np\n\n### Delete rows\n\nd\n\n## Old name\n\no\n');
  // a CRLF page linking in, with an absolute URL too
  write(dir, 'src/content/docs/other.md', (fm('other') + 'See [aliases](/tables/#aliases), [keys](/tables/#primary-keys),\n[rows](https://help.keboola.com/tables/#delete-rows) and [old](/tables/#old-name).\n').replace(/\n/g, '\r\n'));
  write(dir, '_data/navigation.yml', '- url: /tables/\n');
  git(dir, 'init', '-q', '-b', 'main'); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'split');
  write(dir, 'src/content/docs/tables/index.md', fm('tables') + '## Aliases\n\na\n');
  write(dir, 'src/content/docs/tables/keys.md', fm('tables/keys') + '## Primary keys\n\np\n');
  write(dir, 'src/content/docs/tables/manage.md', fm('tables/manage') + '## Delete rows\n\nd\n\n## New name\n\no\n');
  return dir;
}
const run = (dir, ...a) => spawnSync(process.execPath, [SCRIPT, '--root', dir, '--page', '/tables/', ...a], { encoding: 'utf8' });

test('links to moved headings go to their new page; kept anchors and CRLF stay; unmapped ones are listed', () => {
  const dir = split();
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  const other = fs.readFileSync(path.join(dir, 'src/content/docs/other.md'), 'utf8');
  assert.match(other, /\]\(\/tables\/#aliases\)/, 'the hub still has #aliases');
  assert.match(other, /\]\(\/tables\/keys\/#primary-keys\)/);
  assert.match(other, /\]\(https:\/\/help\.keboola\.com\/tables\/manage\/#delete-rows\)/);
  assert.match(other, /\]\(\/tables\/#old-name\)/, 'a renamed heading is not guessed');
  assert.match(r.stdout, /other\.md:\d+\s+\/tables\/#old-name/);
  assert.equal(other.split('\r\n').length, other.split('\n').length, 'every line still ends in CRLF');
});

test('--map sends a renamed heading where it went; --dry-run writes nothing', () => {
  const dir = split();
  const map = path.join(dir, 'map.json');
  fs.writeFileSync(map, JSON.stringify({ '#old-name': '/tables/manage/#new-name' }));
  const before = fs.readFileSync(path.join(dir, 'src/content/docs/other.md'), 'utf8');
  const dry = run(dir, '--map', map, '--dry-run', '--json');
  assert.equal(JSON.parse(dry.stdout).rewritten['src/content/docs/other.md'], 3);
  assert.equal(fs.readFileSync(path.join(dir, 'src/content/docs/other.md'), 'utf8'), before);
  run(dir, '--map', map);
  assert.match(fs.readFileSync(path.join(dir, 'src/content/docs/other.md'), 'utf8'), /\]\(\/tables\/manage\/#new-name\)/);
});

test('a longer URL that only ends with the page path is not rewritten', () => {
  const dir = split();
  write(dir, 'src/content/docs/elsewhere.md', fm('elsewhere') + 'See [the other keys](/storage/tables/#primary-keys) and [ours](/tables/#primary-keys).\n');
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  const text = fs.readFileSync(path.join(dir, 'src/content/docs/elsewhere.md'), 'utf8');
  assert.match(text, /\]\(\/storage\/tables\/#primary-keys\)/, 'a different page keeps its link');
  assert.match(text, /\]\(\/tables\/keys\/#primary-keys\)/);
});
