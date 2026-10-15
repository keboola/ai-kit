// gate.test.mjs — node --test <plugin>/scripts/gate.test.mjs
// Builds a throwaway git repo from the docs-diataxis-check fixture and pipes PreToolUse inputs into gate.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, 'gate.mjs');
const SIDEBAR = path.join(HERE, 'sidebar-regen.sh');
const FIXTURE = path.join(HERE, '..', 'skills', 'docs-diataxis-check', 'scripts', 'fixtures', 'repo');
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', DOCS_GATE: '' };
const git = (dir, ...a) => { const r = spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: GIT_ENV }); assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`); return r.stdout; };
const PAGE = (dir, name) => path.join(dir, 'src', 'content', 'docs', 'guide', name);

function repo({ docs = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  if (docs) {
    fs.cpSync(FIXTURE, dir, { recursive: true });
    fs.rmSync(path.join(dir, 'dist'), { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, 'public', 'guide'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'public', 'guide', 'pic.png'), '');
    const p = PAGE(dir, 'clean-howto.md');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('**Next:**', '![The guide](/guide/pic.png)\n\n**Next:**'));
  } else fs.writeFileSync(path.join(dir, 'README.md'), 'x\n');
  git(dir, 'init', '-q'); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'base');
  return dir;
}
function gate(dir, command, env = {}) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: dir });
  const r = spawnSync(process.execPath, [GATE], { cwd: dir, input, encoding: 'utf8', env: { ...GIT_ENV, ...env } });
  assert.equal(r.status, 0, `gate exited ${r.status}: ${r.stderr}`);
  return r.stdout ? JSON.parse(r.stdout) : null;
}
const denied = (o) => o?.hookSpecificOutput?.permissionDecision === 'deny' ? o.hookSpecificOutput.permissionDecisionReason : null;

test('a clean staged page passes with a summary and no deny', () => {
  const dir = repo();
  fs.appendFileSync(PAGE(dir, 'clean-howto.md'), '\n');
  git(dir, 'add', '-A');
  const o = gate(dir, 'git commit -m "touch"');
  assert.equal(denied(o), null);
  assert.match(o.systemMessage, /docs gate: ✓ 1 page · 0 fail/);
});

test('a new page without a lede is denied and the reason names D3', () => {
  const dir = repo();
  fs.writeFileSync(PAGE(dir, 'new.md'), "---\ntitle: New\nslug: 'guide/new'\ndescription: 'x'\n---\n\n## Starts with a heading\n\ntext\n\n**Next:** [Clean how-to →](/guide/clean-howto/)\n");
  git(dir, 'add', '-A');
  const reason = denied(gate(dir, 'git commit -m "new page"'));
  assert.ok(reason, 'expected a deny');
  assert.match(reason, /guide\/new\.md:\d+ D3 /);
  assert.match(reason, /DOCS_GATE=skip/);
});

test('a TEMPLATE: leftover is denied under D16', () => {
  const dir = repo();
  const p = PAGE(dir, 'clean-howto.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('**Goal:** have a working guide in one minute.', '**Goal:** TEMPLATE: fill me'));
  git(dir, 'add', '-A');
  assert.match(denied(gate(dir, 'git commit -m x')) ?? '', /D16/);
});

test('DOCS_GATE=skip as a command prefix or in the environment bypasses the gate', () => {
  const dir = repo();
  fs.writeFileSync(PAGE(dir, 'new.md'), '## no frontmatter at all\n');
  git(dir, 'add', '-A');
  assert.match(gate(dir, 'DOCS_GATE=skip git commit -m x').systemMessage, /skipped/);
  assert.match(gate(dir, 'git commit -m x', { DOCS_GATE: 'skip' }).systemMessage, /skipped/);
  assert.ok(denied(gate(dir, 'git commit -m x')), 'without the hatch it still denies');
});

test('commands that are not a commit, repos that are not docs, and an amend with nothing staged are silent', () => {
  const dir = repo();
  assert.equal(gate(dir, 'ls -la'), null);
  assert.equal(gate(dir, 'git commit-tree HEAD^{tree} -m x'), null);
  assert.equal(gate(dir, 'git commit --amend --no-edit'), null);
  const plain = repo({ docs: false });
  fs.writeFileSync(path.join(plain, 'a.md'), 'x'); git(plain, 'add', '-A');
  assert.equal(gate(plain, 'git commit -m x'), null);
});

test('git -C <dir> commit is gated from another cwd', () => {
  const dir = repo();
  fs.writeFileSync(PAGE(dir, 'new.md'), '## heading first\n'); git(dir, 'add', '-A');
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command: `git -C ${dir} commit -m x` }, cwd: os.tmpdir() });
  const r = spawnSync(process.execPath, [GATE], { input, encoding: 'utf8', env: GIT_ENV });
  assert.ok(denied(JSON.parse(r.stdout)));
});

test('deleting a page without a redirect_from anywhere is denied; with one it passes', () => {
  const dir = repo();
  const p = PAGE(dir, 'clean-howto.md');
  // clean-howto's Next pointed at the page being retired; repoint it first (D5 would otherwise fail on its own)
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('[No description →](/guide/no-desc/)', '[Guide →](/guide/)'));
  git(dir, 'rm', '-q', 'src/content/docs/guide/no-desc.md'); git(dir, 'add', '-A');
  const reason = denied(gate(dir, 'git commit -m "retire"'));
  assert.match(reason ?? '', /retired, but no page lists \/guide\/no-desc\/ in redirect_from/);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace("slug: 'guide/clean-howto'\n", "slug: 'guide/clean-howto'\nredirect_from:\n  - /guide/no-desc/\n"));
  git(dir, 'add', '-A');
  assert.equal(denied(gate(dir, 'git commit -m "retire"')), null);
});

test('deleting media a page still references is denied; an orphan is only a warning', () => {
  const dir = repo();
  git(dir, 'rm', '-q', 'public/guide/pic.png');
  assert.match(denied(gate(dir, 'git commit -m x')) ?? '', /pic\.png deleted, but still referenced by src\/content\/docs\/guide\/clean-howto\.md/);
  git(dir, 'reset', '-q', '--hard');
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'orphan.png'), ''); fs.appendFileSync(PAGE(dir, 'clean-howto.md'), '\n'); git(dir, 'add', '-A');
  const o = gate(dir, 'git commit -m x');
  assert.equal(denied(o), null);
  assert.match(o.hookSpecificOutput?.additionalContext ?? '', /no dist\//);
});

test('sidebar-regen.sh ignores unrelated files and survives a bad project dir', () => {
  const run = (file, env) => spawnSync(SIDEBAR, [], { input: JSON.stringify({ tool_input: { file_path: file } }), encoding: 'utf8', env: { ...process.env, ...env } }).stdout;
  assert.equal(run('/x/src/content/docs/a.md', {}), '');
  assert.equal(run('/x/_data/navigation.yml', { CLAUDE_PROJECT_DIR: '/nonexistent-xyz' }), '');
});

test('dropping a page that never reached the base branch needs no redirect', () => {
  const dir = repo();
  git(dir, 'branch', '-q', 'main');                          // the base: the fixture as published
  fs.writeFileSync(PAGE(dir, 'draft.md'), fs.readFileSync(PAGE(dir, 'clean-howto.md'), 'utf8').replace("slug: 'guide/clean-howto'", "slug: 'guide/draft'"));
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'draft page on the branch');
  git(dir, 'rm', '-q', 'src/content/docs/guide/draft.md');
  assert.equal(denied(gate(dir, 'git commit --amend -m x')), null);
  git(dir, 'reset', '-q', '--hard');
  git(dir, 'rm', '-q', 'src/content/docs/guide/no-desc.md');   // this one IS on main
  assert.match(denied(gate(dir, 'git commit -m x')) ?? '', /no-desc/);
});

test('the gate judges the staged blob: an unstaged fix does not save a broken staged page, and an unstaged break does not block a good one', () => {
  const dir = repo();
  const p = PAGE(dir, 'clean-howto.md');
  const good = fs.readFileSync(p, 'utf8');
  const broken = good.replace(/^Practical recipes.*$/m, '## Heading first');
  fs.writeFileSync(p, broken); git(dir, 'add', '-A');           // staged: broken
  fs.writeFileSync(p, good);                                       // working tree: fixed, not staged
  assert.match(denied(gate(dir, 'git commit -m x')) ?? '', /D3/);
  git(dir, 'add', '-A');                                           // staged: good
  fs.writeFileSync(p, broken);                                     // working tree: broken, not staged
  assert.equal(denied(gate(dir, 'git commit -m x')), null);
  assert.match(denied(gate(dir, 'git commit -am x')) ?? '', /D3/, 'commit -a takes the working tree');
});

test('deleting a public image that a page reaches only through a relative <img> is denied', () => {
  const dir = repo();
  fs.mkdirSync(path.join(dir, 'public', 'guide', 'clean-howto'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'public', 'guide', 'clean-howto', 'raw.png'), '');
  const p = PAGE(dir, 'clean-howto.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('**Next:**', '<img src="raw.png" alt="raw">\n\n**Next:**'));
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'relative img');
  git(dir, 'rm', '-q', 'public/guide/clean-howto/raw.png');
  assert.match(denied(gate(dir, 'git commit -m x')) ?? '', /public\/guide\/clean-howto\/raw\.png deleted, but still referenced/);
});
