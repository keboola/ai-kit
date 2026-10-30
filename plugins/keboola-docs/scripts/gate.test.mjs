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
  assert.match(reason ?? '', /navigation\.yml still lists \/guide\/no-desc\//);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace("slug: 'guide/clean-howto'\n", "slug: 'guide/clean-howto'\nredirect_from:\n  - /guide/no-desc/\n"));
  git(dir, 'add', '-A');
  // the redirect alone is not enough while the nav still lists the retired page
  assert.match(denied(gate(dir, 'git commit -m "retire"')) ?? '', /navigation\.yml still lists/);
  const nav = path.join(dir, '_data', 'navigation.yml');
  fs.writeFileSync(nav, fs.readFileSync(nav, 'utf8').replace(/ *- url: \/guide\/no-desc\/\n *title: No description\n/, ''));
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

// ---- 0.6.0: command parsing, old debt, nav, messages, log -----------------------------------------

test('staging and committing in one command is refused, whatever is staged', () => {
  const dir = repo();
  fs.writeFileSync(PAGE(dir, 'new.md'), "---\ntitle: New\nslug: 'guide/new'\ndescription: d\n---\n\n## Steps\n\n1. x\n");
  for (const cmd of ['git add -A && git commit -m x', 'git add src/content/docs/guide/new.md; git commit -m x', 'git rm -q --cached README.md\ngit commit -m x']) {
    assert.match(denied(gate(dir, cmd)) ?? '', /in one command[\s\S]*Stage in one call, then commit in the next/, cmd);
  }
  // a plain status or log before the commit is fine
  assert.equal(denied(gate(dir, 'git status --short && git commit -m x')), null);
});

test('a heredoc or a quoted string that mentions git commit is not a commit', () => {
  const dir = repo();
  fs.copyFileSync(path.join(FIXTURE, 'src/content/docs/guide/no-lede.md'), PAGE(dir, 'staged-bad.md'));
  git(dir, 'add', '-A');
  assert.equal(gate(dir, "cat >> log.md <<'EOF'\nthen `git add x && git commit -m y`\n; git commit -F -\nEOF"), null);
  assert.equal(gate(dir, 'echo "; git commit -m x"'), null);
  // but a commit on the second line of a command is a commit
  assert.match(denied(gate(dir, 'echo start\ngit commit -m x')) ?? '', /D3/);
});

test('a message that looks like a flag does not turn the commit into -a', () => {
  const dir = repo();
  const p = PAGE(dir, 'clean-howto.md');
  const good = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, good.replace('**Next:**', 'One more line.\n\n**Next:**'));
  git(dir, 'add', '-A');
  fs.writeFileSync(p, good.replace(/^Practical recipes.*\n\n/m, ''));   // unstaged break: lede gone
  assert.equal(denied(gate(dir, 'git commit -m "fix -bar and -all"')), null);
  // control: a real -a takes the broken working tree and is denied
  assert.match(denied(gate(dir, 'git commit -am "x"')) ?? '', /D3/);
});

test('a FAIL the page already had on main is a warning, a new FAIL still blocks', () => {
  const dir = repo();
  git(dir, 'branch', 'main');
  const p = PAGE(dir, 'no-desc.md');             // on main it fails D1 (no description)
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('More prose.', 'More prose, with a [link](/guide/).'));
  git(dir, 'add', '-A');
  const o = gate(dir, 'git commit -m "one link"');
  assert.equal(denied(o), null);
  assert.match(o.hookSpecificOutput.additionalContext, /D1 .*already on main, not this change/);
  // a VERIFY without an owner added to the same old page is never old debt
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('More prose', '<!-- VERIFY: check this -->\n\nMore prose'));
  git(dir, 'add', '-A');
  assert.match(denied(gate(dir, 'git commit -m x')) ?? '', /D9/);
});

test('a new page has no main version, so its FAILs block', () => {
  const dir = repo();
  git(dir, 'branch', 'main');
  fs.copyFileSync(path.join(FIXTURE, 'src/content/docs/guide/no-lede.md'), PAGE(dir, 'brand-new.md'));
  git(dir, 'add', '-A');
  assert.match(denied(gate(dir, 'git commit -m x')) ?? '', /brand-new\.md.* D3/);
});

test('the deny counts files, not touched pages', () => {
  const dir = repo();
  fs.copyFileSync(path.join(FIXTURE, 'src/content/docs/guide/no-lede.md'), PAGE(dir, 'bad.md'));
  fs.writeFileSync(PAGE(dir, 'bad.md'), fs.readFileSync(PAGE(dir, 'bad.md'), 'utf8').replace(/^description:.*\n/m, ''));
  const c = PAGE(dir, 'clean-howto.md'); fs.writeFileSync(c, fs.readFileSync(c, 'utf8').replace('**Next:**', 'x\n\n**Next:**'));
  git(dir, 'add', '-A');
  const reason = denied(gate(dir, 'git commit -m x')) ?? '';
  assert.match(reason, /^docs gate: \d+ FAILs? in 1 file\n/);
});

test('an allow tells the agent what the gate saw, and the decision is logged with the tree', () => {
  const dir = repo();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-data-'));
  const p = PAGE(dir, 'clean-howto.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('**Next:**', 'One more line.\n\n**Next:**'));
  git(dir, 'add', '-A');
  const o = gate(dir, 'git commit -m x', { CLAUDE_PLUGIN_DATA: data });
  assert.match(o.hookSpecificOutput.additionalContext, /^docs gate: ✓ 1 page · 0 fail/);
  const log = fs.readFileSync(path.join(data, 'gate-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(log.at(-1).decision, 'allow');
  assert.equal(log.at(-1).tree, git(dir, 'write-tree').trim());
  const s = gate(dir, 'DOCS_GATE=skip git commit -m x', { CLAUDE_PLUGIN_DATA: data });
  assert.match(s.hookSpecificOutput.additionalContext, /nothing was checked/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'gate-log.jsonl'), 'utf8').trim().split('\n').at(-1)).decision, 'skip');
});

test('git by absolute path or inside bash -c is gated too', () => {
  const dir = repo();
  fs.copyFileSync(path.join(FIXTURE, 'src/content/docs/guide/no-lede.md'), PAGE(dir, 'abs.md'));
  git(dir, 'add', '-A');
  const gitPath = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  assert.match(denied(gate(dir, `${gitPath} commit -m x`)) ?? '', /D3/);
  assert.match(denied(gate(dir, 'bash -c "git commit -m x"')) ?? '', /D3/);
});

test('a deny also lists what was downgraded; retiring a page reports the media it orphans', () => {
  const dir = repo();
  git(dir, 'branch', 'main');
  // clean-howto is the only page that shows /guide/pic.png; retire it without touching the nav
  git(dir, 'rm', '-q', 'src/content/docs/guide/clean-howto.md');
  const nd = PAGE(dir, 'no-desc.md');   // old D1 debt on main, receives the redirect
  fs.writeFileSync(nd, fs.readFileSync(nd, 'utf8').replace("slug: 'guide/no-desc'\n", "slug: 'guide/no-desc'\nredirect_from:\n  - /guide/clean-howto/\n"));
  git(dir, 'add', '-A');
  const reason = denied(gate(dir, 'git commit -m x')) ?? '';
  assert.match(reason, /navigation\.yml still lists \/guide\/clean-howto\//);
  assert.match(reason, /Also \(not blocking\):[\s\S]*D1 .*already on main/);
  assert.match(reason, /public\/guide\/pic\.png is referenced by no page any more/);
});

test('for git commit -a the log records the tree the commit will have', () => {
  const dir = repo();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-data-'));
  const p = PAGE(dir, 'clean-howto.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('**Next:**', 'One more line.\n\n**Next:**'));   // unstaged
  assert.equal(denied(gate(dir, 'git commit -am x', { CLAUDE_PLUGIN_DATA: data })), null);
  git(dir, 'commit', '-q', '-am', 'x');
  const entry = JSON.parse(fs.readFileSync(path.join(data, 'gate-log.jsonl'), 'utf8').trim().split('\n').at(-1));
  assert.equal(entry.scope, 'worktree');
  assert.equal(entry.tree, git(dir, 'rev-parse', 'HEAD^{tree}').trim());
  assert.equal(git(dir, 'status', '--porcelain').trim(), '', 'the real index was not touched beyond the commit');
});

test('an amend is judged against the parent, and every decision is logged', () => {
  const dir = repo();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-data-'));
  fs.copyFileSync(path.join(FIXTURE, 'src/content/docs/guide/no-lede.md'), PAGE(dir, 'amended.md'));
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'sneaked in');   // committed outside the gate
  // nothing staged: the amend still carries amended.md, so it is judged
  assert.match(denied(gate(dir, 'git commit --amend --no-edit', { CLAUDE_PLUGIN_DATA: data })) ?? '', /amended\.md.* D3/);
  // a commit with no docs change is allowed and still logged
  fs.writeFileSync(path.join(dir, 'README.txt'), 'x\n'); git(dir, 'add', 'README.txt');
  assert.equal(denied(gate(dir, 'git commit -m readme', { CLAUDE_PLUGIN_DATA: data })), null);
  const last = JSON.parse(fs.readFileSync(path.join(data, 'gate-log.jsonl'), 'utf8').trim().split('\n').at(-1));
  assert.equal(last.decision, 'allow');
  assert.equal(last.note, 'no docs change');
});

test('a cd before the commit is followed, so the gate runs on that checkout', () => {
  const dir = repo();
  fs.copyFileSync(path.join(FIXTURE, 'src/content/docs/guide/no-lede.md'), PAGE(dir, 'cd.md'));
  git(dir, 'add', '-A');
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command: `cd ${dir} && git commit -m x` }, cwd: os.tmpdir() });
  const r = spawnSync(process.execPath, [GATE], { cwd: os.tmpdir(), input, encoding: 'utf8', env: GIT_ENV });
  assert.match(denied(JSON.parse(r.stdout || 'null')) ?? '', /cd\.md.* D3/);
});

test('a dist/ older than the sources turns link blockers into a rebuild WARN', () => {
  const dir = repo();
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'scripts', 'convert-nav.mjs'), '');
  const stub = '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/guide/"></head><body></body></html>';
  fs.mkdirSync(path.join(dir, 'dist', 'guide', 'clean-howto'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dist', 'guide', 'clean-howto', 'index.html'), stub);
  fs.writeFileSync(path.join(dir, 'dist', 'index.html'), '<html></html>');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'build'); git(dir, 'branch', '-f', 'main');
  const old = new Date(Date.now() - 3600e3);
  fs.utimesSync(path.join(dir, 'dist', 'index.html'), old, old);
  fs.appendFileSync(PAGE(dir, 'clean-howto.md'), '\n');
  git(dir, 'add', '-A');
  const stale = gate(dir, 'git commit -m x');
  assert.equal(denied(stale), null, 'stale build: no deny');
  assert.match(stale.hookSpecificOutput?.additionalContext ?? '', /dist\/ is older than the sources/);
  const now = new Date(Date.now() + 60e3);
  fs.utimesSync(path.join(dir, 'dist', 'index.html'), now, now);
  assert.match(denied(gate(dir, 'git commit -m x')) ?? '', /links: /, 'fresh build: the blocker denies');
});

test("a retired page's own old URLs must stay in some redirect_from", () => {
  const dir = repo();
  const nd = PAGE(dir, 'no-desc.md');
  fs.writeFileSync(nd, fs.readFileSync(nd, 'utf8').replace("slug: 'guide/no-desc'\n", "slug: 'guide/no-desc'\nredirect_from:\n  - /guide/ancient/\n"));
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'old url'); git(dir, 'branch', '-f', 'main');
  const p = PAGE(dir, 'clean-howto.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('[No description →](/guide/no-desc/)', '[Guide →](/guide/)')
    .replace("slug: 'guide/clean-howto'\n", "slug: 'guide/clean-howto'\nredirect_from:\n  - /guide/no-desc/\n"));
  const nav = path.join(dir, '_data', 'navigation.yml');
  fs.writeFileSync(nav, fs.readFileSync(nav, 'utf8').replace(/ *- url: \/guide\/no-desc\/\n *title: No description\n/, ''));
  git(dir, 'rm', '-q', 'src/content/docs/guide/no-desc.md'); git(dir, 'add', '-A');
  assert.match(denied(gate(dir, 'git commit -m "retire"')) ?? '', /its own old URL \/guide\/ancient\/ is no longer in any redirect_from/);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('  - /guide/no-desc/\n', '  - /guide/no-desc/\n  - /guide/ancient/\n'));
  git(dir, 'add', '-A');
  assert.equal(denied(gate(dir, 'git commit -m "retire"')), null);
});

test('a page whose lines changed only in their line endings is denied (G2, G5)', () => {
  const dir = repo();
  const p = PAGE(dir, 'clean-howto.md');
  const t = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, t.replace(/\n/g, '\r\n').replace('\r\n\r\n', '\r\n\r\nOne real new line.\r\n\r\n'));
  git(dir, 'add', '-A');
  assert.match(denied(gate(dir, 'git commit -m x')) ?? '', /changed only in their line endings/);
  fs.writeFileSync(p, t.replace('\n\n', '\n\nOne real new line.\n\n'));
  git(dir, 'add', '-A');
  assert.doesNotMatch(denied(gate(dir, 'git commit -m x')) ?? '', /line endings/);
});

test('`git commit -m "msg" <paths>` logs the tree the commit records, and gate-verdict finds it in any keboola-docs-* log', () => {
  const dir = repo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-home-'));
  const data = path.join(home, '.claude', 'plugins', 'data', 'keboola-docs-inline');   // not the marketplace id
  fs.appendFileSync(PAGE(dir, 'clean-howto.md'), '\nOne more line.\n');
  const cmd = 'git commit -m "touch the page" src/content/docs/guide/clean-howto.md';
  assert.equal(denied(gate(dir, cmd, { CLAUDE_PLUGIN_DATA: data })), null);
  git(dir, 'commit', '-q', '-m', 'touch the page', 'src/content/docs/guide/clean-howto.md');
  const head = git(dir, 'rev-parse', 'HEAD^{tree}').trim();
  const logged = fs.readFileSync(path.join(data, 'gate-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).pop();
  assert.equal(logged.tree, head, 'the message is not a pathspec: the logged tree is the committed one');
  const v = spawnSync(process.execPath, [path.join(HERE, 'gate-verdict.mjs'), dir], { encoding: 'utf8', env: { ...process.env, HOME: home, CLAUDE_PLUGIN_DATA: '' } });
  assert.equal(v.status, 0, v.stdout + v.stderr);
  assert.match(v.stdout, /gate allow/);
  fs.appendFileSync(PAGE(dir, 'clean-howto.md'), '\nUnjudged.\n');
  git(dir, 'commit', '-q', '-am', 'bypass');
  const none = spawnSync(process.execPath, [path.join(HERE, 'gate-verdict.mjs'), dir], { encoding: 'utf8', env: { ...process.env, HOME: home, CLAUDE_PLUGIN_DATA: '' } });
  assert.equal(none.status, 1);
  assert.match(none.stdout, /bypassed the gate/);
});

test('a heredoc commit logs its tree in the git dir; gate-verdict ignores the same tree logged by another clone', () => {
  const dir = repo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-home-'));
  const data = path.join(home, '.claude', 'plugins', 'data', 'keboola-docs-inline');
  fs.appendFileSync(PAGE(dir, 'clean-howto.md'), '\nOne more line.\n');
  git(dir, 'add', '-A');
  // `<<'EOF'` used to be read as a pathspec: the entry had tree null and the commit looked unjudged
  assert.equal(denied(gate(dir, "git commit -q -F - <<'EOF'\ntouch\nEOF", { CLAUDE_PLUGIN_DATA: data })), null);
  git(dir, 'commit', '-q', '-m', 'touch');
  const head = git(dir, 'rev-parse', 'HEAD^{tree}').trim();
  const own = path.join(dir, '.git', 'keboola-docs', 'gate-log.jsonl');
  assert.equal(JSON.parse(fs.readFileSync(own, 'utf8').trim().split('\n').pop()).tree, head);
  const verdict = (d, env) => spawnSync(process.execPath, [path.join(HERE, 'gate-verdict.mjs'), d], { encoding: 'utf8', env: { ...process.env, HOME: home, CLAUDE_PLUGIN_DATA: '', ...env } });
  fs.rmSync(path.join(data, 'gate-log.jsonl'));   // the git-dir log alone is enough
  assert.equal(verdict(dir).status, 0);
  // a clone holds the same tree; the copy in the plugin data dir names the first repo, so it does not count
  fs.appendFileSync(path.join(data, 'gate-log.jsonl'), fs.readFileSync(own, 'utf8'));
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-clone-'));
  git(clone, 'clone', '-q', dir, '.');
  const v = verdict(clone);
  assert.equal(v.status, 1, v.stdout);
  assert.match(v.stdout, /bypassed the gate/);
});

test("a merge commit is judged on its own changes, not on the merged-in side's pages", () => {
  const dir = repo();
  git(dir, 'branch', '-M', 'main');
  git(dir, 'checkout', '-q', '-b', 'feature');
  fs.appendFileSync(PAGE(dir, 'clean-howto.md'), '\nA feature line.\n');
  git(dir, 'commit', '-q', '-am', 'feature');
  git(dir, 'checkout', '-q', 'main');
  // main brings a page with a FAIL (no lede) and a CRLF rewrite of another page
  fs.writeFileSync(PAGE(dir, 'from-main.md'), "---\ntitle: From main\nslug: 'guide/from-main'\ndescription: 'x'\n---\n\n## Starts with a heading\n\ntext\n");
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'main moves on');
  git(dir, 'checkout', '-q', 'feature');
  spawnSync('git', ['merge', '--no-commit', '--no-ff', 'main'], { cwd: dir, env: GIT_ENV });
  assert.equal(denied(gate(dir, 'git commit --no-edit')), null, 'main\'s page is not this merge\'s change');
  // a resolution that edits main's page is judged
  fs.appendFileSync(PAGE(dir, 'from-main.md'), '\nEdited in the merge.\n');
  git(dir, 'add', '-A');
  assert.match(denied(gate(dir, 'git commit --no-edit')) ?? '', /from-main\.md:\d+ D3 /);
});
