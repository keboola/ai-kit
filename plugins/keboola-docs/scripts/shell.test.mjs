// Tests for lib/shell.mjs, the command parser the commit gate uses. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segments, commitScope, stripHeredocs } from './lib/shell.mjs';

const gitSubs = (cmd) => segments(cmd).filter((s) => s.git).map((s) => s.git.sub);

test('chains, newlines and subshells split into commands', () => {
  assert.deepEqual(gitSubs('git add a.md && git commit -m x'), ['add', 'commit']);
  assert.deepEqual(gitSubs('git add a.md\ngit commit -m x'), ['add', 'commit']);
  assert.deepEqual(gitSubs('(cd x; git status) || git commit -m "y"'), ['status', 'commit']);
  assert.deepEqual(gitSubs('npm test | tail -2; git log -1'), ['log']);
});

test('a heredoc body or a quoted string is data, not a command', () => {
  const cmd = "cat >> log.md <<'EOF'\nthen I ran `git add x && git commit -m y`\n; git commit -F -\nEOF\necho done";
  assert.deepEqual(gitSubs(cmd), []);
  assert.equal(stripHeredocs(cmd).includes('git commit'), false);
  assert.deepEqual(gitSubs('echo "; git commit -m x"'), []);
  assert.deepEqual(gitSubs("printf '%s' 'a && git commit'"), []);
  // a commit whose message comes from a heredoc is still a commit
  assert.deepEqual(gitSubs("git commit -q -F - <<'EOF'\nsubject\n\nbody with git add in it\nEOF"), ['commit']);
});

test('git global options, -C and env prefixes are read', () => {
  const [s] = segments('DOCS_GATE=skip git -C ../docs -c user.name=x commit -m "a"');
  assert.equal(s.env.DOCS_GATE, 'skip');
  assert.equal(s.git.C, '../docs');
  assert.equal(s.git.sub, 'commit');
  assert.deepEqual(gitSubs('git commit-tree abc'), ['commit-tree']);
});

test('commitScope reads -a and pathspecs from flags, not from the message text', () => {
  assert.deepEqual(commitScope(['-m', 'fix -bar and -all']), { all: false, paths: false });
  assert.deepEqual(commitScope(['-am', 'msg']), { all: true, paths: false });
  assert.deepEqual(commitScope(['--all', '-m', 'x']), { all: true, paths: false });
  assert.deepEqual(commitScope(['-m', 'x', '--', 'src/a.md']), { all: false, paths: true });
  assert.deepEqual(commitScope(['-m', 'x', 'src/a.md']), { all: false, paths: true });
  assert.deepEqual(commitScope(['-q', '-F', '-']), { all: false, paths: false });
});

test('git by absolute path, escaped or behind env/sudo is still git', () => {
  assert.deepEqual(gitSubs('/opt/homebrew/bin/git commit -m x'), ['commit']);
  assert.deepEqual(gitSubs('\\git commit -m x'), ['commit']);
  assert.deepEqual(gitSubs('env GIT_AUTHOR_NAME=x git commit -m y'), ['commit']);
  assert.deepEqual(gitSubs('/usr/bin/git add a && /usr/bin/git commit -m x'), ['add', 'commit']);
  assert.deepEqual(gitSubs('legit commit'), []);
  assert.deepEqual(gitSubs('bash -c "git add a && git commit -m x"'), ['add', 'commit']);
  assert.deepEqual(gitSubs("sh -c 'cd docs; git commit -m x'"), ['commit']);
});
