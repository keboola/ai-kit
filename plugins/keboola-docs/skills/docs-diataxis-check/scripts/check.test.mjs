// check.test.mjs — runs check.mjs over the fixture repo and pins one outcome per rule.
//   node --test <plugin>/skills/docs-diataxis-check/scripts/check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'check.mjs');
const REPO = path.join(HERE, 'fixtures', 'repo');
const page = (name) => path.join('src', 'content', 'docs', 'guide', name);
const doc = (name) => path.join('src', 'content', 'docs', name);

function run(args, env = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', REPO, '--json', ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { /* leave null so the assertion below says what happened */ }
  assert.ok(out, `no JSON on stdout (status ${r.status}): ${r.stdout}\n${r.stderr}`);
  return { status: r.status, out, first: out.pages[0] };
}
const ids = (p, level) => p.findings.filter((f) => !level || f.level === level).map((f) => f.id);
const find = (p, id) => p.findings.filter((f) => f.id === id);

test('a clean how-to passes with no FAIL and no WARN', () => {
  const { status, first } = run([page('clean-howto.md')]);
  assert.equal(status, 0);
  assert.equal(first.verdict, 'PASS');
  assert.deepEqual(ids(first, 'FAIL'), []);
  assert.deepEqual(ids(first, 'WARN'), []);
  assert.equal(first.type.declared, 'how-to');
});

test("D1: the site root's empty slug is not a missing slug", () => {
  const { first } = run([doc('index.md')]);
  assert.equal(first.url, '/');
  assert.deepEqual(find(first, 'D1'), []);
});

test('D1: missing description is a FAIL', () => {
  const { status, first } = run([page('no-desc.md')]);
  assert.equal(status, 1);
  assert.ok(ids(first, 'FAIL').includes('D1'));
  assert.match(find(first, 'D1')[0].msg, /description/);
});

test('D4: an H1 in the body is a FAIL with its line', () => {
  const { first } = run([page('no-desc.md')]);
  const f = find(first, 'D4');
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'FAIL');
  assert.equal(f[0].line, 8);
});

test('D4: a hash comment inside a fence is not an H1', () => {
  const { first } = run([page('fenced-h1.md')]);
  assert.deepEqual(find(first, 'D4'), []);
});

test('D2: a missing type marker is a WARN, a PageMeta genre counts as declared', () => {
  const noMarker = run([page('no-desc.md')]).first;
  assert.ok(ids(noMarker, 'WARN').includes('D2'));
  assert.equal(noMarker.type.declared, null);
  const pm = run([page('pagemeta.mdx')]).first;
  assert.deepEqual(find(pm, 'D2'), []);
  assert.equal(pm.type.declared, 'tutorial');
  assert.equal(pm.type.via, 'PageMeta');
});

test('D2: a type marker above the lede is a WARN, and the type is still read from it', () => {
  const { first } = run([page('marker-first.md')]);
  const f = find(first, 'D2');
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'WARN');
  assert.match(f[0].msg, /type marker before the lede/);
  assert.equal(first.type.declared, 'explanation');
  assert.deepEqual(find(run([page('before-sub.md')]).first, 'D2'), []);
});

test('D3: a page that opens with a heading has no lede', () => {
  const { first } = run([page('no-lede.md')]);
  assert.ok(ids(first, 'FAIL').includes('D3'));
  assert.deepEqual(find(run([page('pagemeta.mdx')]).first, 'D3'), []);
});

test('D5: a Next that does not resolve is a FAIL', () => {
  const { first } = run([page('broken-next.md')]);
  const f = find(first, 'D5');
  assert.equal(f[0].level, 'FAIL');
  assert.match(f[0].msg, /\/guide\/nowhere\//);
});

test('D5: the last page of a nested nav group may omit Next', () => {
  // nest/group/b.md is the last page of the Nest group and has no Next line at all
  assert.deepEqual(find(run([doc('nest/group/b.md')]).first, 'D5'), []);
  assert.deepEqual(find(run([page('sub/first.md')]).first, 'D5'), []);
});

test('D5: a prose Next on an exempt page is a WARN, on a page that is not exempt a FAIL', () => {
  const exempt = find(run([page('sub/last.md')]).first, 'D5');
  assert.equal(exempt.length, 1);
  assert.equal(exempt[0].level, 'WARN');
  assert.match(exempt[0].msg, /prose Next on an exempt page/);
  const notExempt = find(run([page('prose-next.md')]).first, 'D5');
  assert.equal(notExempt.length, 1);
  assert.equal(notExempt[0].level, 'FAIL');
  assert.match(notExempt[0].msg, /is not `\*\*Next:\*\* \[label/);
});

test("D12: the page before a nested group points at the group's index, and the index at its first child", () => {
  for (const f of ['before-sub.md', 'sub/index.md']) {
    const { first } = run([page(f)]);
    assert.deepEqual(find(first, 'D12'), [], f);
    assert.deepEqual(find(first, 'D5'), [], f);
  }
});

test("nav: a group's index resolves to its own sequence whatever order the sequences were built in", () => {
  // The test hook reverses the sequence list after building, so the parent sequence (which also
  // holds the group's url as a stop) comes first; the explicit group index must still win.
  const { first } = run([page('sub/index.md')], { DIATAXIS_CHECK_NAV_ORDER: 'reverse' });
  assert.equal(first.nav.section, 'Sub section');
  assert.equal(first.nav.next, '/guide/sub/first/');
  assert.deepEqual(find(first, 'D12'), []);
  const before = run([page('before-sub.md')], { DIATAXIS_CHECK_NAV_ORDER: 'reverse' }).first;
  assert.equal(before.nav.next, '/guide/sub/');
});

test('nav: a label-only group inside a url group belongs to the url group, a url item with items: [] is a leaf', () => {
  const a = run([doc('nest/group/a.md')]).first;
  const b = run([doc('nest/group/b.md')]).first;
  assert.equal(a.nav.section, 'Nest group');
  assert.equal(a.nav.next, '/nest/group/b/');
  assert.equal(b.nav.section, 'Nest group');
  assert.equal(b.nav.last, true);
  const leaf = run([doc('nest/leaf.md')]).first;
  assert.equal(leaf.nav.section, 'Nest');
  assert.equal(leaf.nav.last, true);
});

test('D5: the last page of a section and a reference page may omit Next', () => {
  assert.deepEqual(find(run([page('last.md')]).first, 'D5'), []);
  assert.deepEqual(find(run([page('verify-no-owner.md')]).first, 'D5'), []);
});

test('D5: a page with the course bar (<CourseLine>) may omit Next or write it as a prose fork', () => {
  // Getting Started, Nikita 2026-10-09: the course bar and the Prev/Next buttons already carry the
  // next step, so a third copy is the duplication the audit found
  assert.deepEqual(find(run([page('course-step.mdx')]).first, 'D5'), []);
  assert.deepEqual(find(run([page('course-fork.mdx')]).first, 'D5'), []);
});

test('D5: a non-exempt page without Next is a FAIL', () => {
  const { first } = run([page('plugin-word.md')]);
  const f = find(first, 'D5');
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'FAIL');
  assert.match(f[0].msg, /no \*\*Next:\*\*/);
});

test('D12: a Next that skips the next nav sibling is a WARN naming the expected page', () => {
  const { first } = run([page('skip-next.md')]);
  const f = find(first, 'D12');
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'WARN');
  assert.match(f[0].msg, /\/guide\/howto-no-goal\//);
  assert.deepEqual(find(run([page('clean-howto.md')]).first, 'D12'), []);
});

test('D6: a page over 250 lines gets the split-trigger WARN', () => {
  const { first } = run([page('long-ref.md')]);
  const f = find(first, 'D6');
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'WARN');
  assert.match(f[0].msg, /298/);
});

test('D7: a declared how-to whose sections lack Goal and Result is a WARN', () => {
  const { first } = run([page('howto-no-goal.md')]);
  const f = find(first, 'D7');
  assert.equal(f[0].level, 'WARN');
  assert.match(f[0].msg, /Set it up/);
  assert.deepEqual(find(run([page('clean-howto.md')]).first, 'D7'), []);
});

test('D7: on a how-to with no ## section, the ### headings are the tasks', () => {
  const { first } = run([page('howto-h3.md')]);
  const f = find(first, 'D7');
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'WARN');
  assert.match(f[0].msg, /Clean up/);
  assert.doesNotMatch(f[0].msg, /Set it up|Run it/);
});

test('D8: two smells on one page is mixed-type EVIDENCE with counts', () => {
  const { first } = run([page('long-ref.md')]);
  const f = find(first, 'D8');
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'EVIDENCE');
  assert.ok(first.counts.orderedLists >= 1);
  assert.ok(first.counts.tables >= 1);
  assert.ok(first.counts.conceptHeadings >= 1);
  assert.ok(first.counts.clickSentences >= 2);
  assert.deepEqual(find(run([page('clean-howto.md')]).first, 'D8'), []);
});

test('D9: VERIFY without an owner is a FAIL, with an owner it is fine', () => {
  const { first } = run([page('verify-no-owner.md')]);
  const f = find(first, 'D9');
  assert.equal(f.length, 2, 'ownerless and placeholder owner');
  assert.equal(f[0].level, 'FAIL');
  assert.equal(f[0].line, 14);
  assert.equal(f[1].line, 20);
  assert.match(f[1].msg, /placeholder/);
  assert.deepEqual(find(run([page('pagemeta.mdx')]).first, 'D9'), []);
});

test('D9: with --dist, a marker that reached dist is a FAIL', () => {
  const { first } = run(['--dist', page('verify-no-owner.md')]);
  const leak = find(first, 'D9').filter((f) => /dist/.test(f.msg));
  assert.equal(leak.length, 1);
  assert.equal(leak[0].level, 'FAIL');
});

test('D10: an overview that is a link directory is EVIDENCE', () => {
  const { first } = run([page('index.md')]);
  const f = find(first, 'D10');
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'EVIDENCE');
  assert.deepEqual(find(run([page('clean-howto.md')]).first, 'D10'), []);
});

test('D11: plugin for a component is a WARN, kbagent plugin is not', () => {
  const { first } = run([page('plugin-word.md')]);
  const f = find(first, 'D11');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, 13);
});

test('summary: several pages, exit 1 when any page fails, counts in the JSON', () => {
  const { status, out } = run([page('clean-howto.md'), page('no-desc.md')]);
  assert.equal(status, 1);
  assert.equal(out.pages.length, 2);
  assert.equal(out.verdict, 'FIX');
  assert.ok(out.fail >= 1);
});

test('D5 and D12: connector catalog pages need no Next, and their alphabetical nav order is not a reading order', () => {
  const w = (n) => doc(path.join('components', 'writers', n, 'index.md'));
  const alpha = run([w('alpha')]).first;
  assert.deepEqual(find(alpha, 'D5'), []);
  assert.deepEqual(find(alpha, 'D12'), []);
  const beta = run([w('beta')]).first;
  assert.deepEqual(find(beta, 'D5'), []);
  assert.deepEqual(find(beta, 'D12'), []);
  const index = run([doc(path.join('components', 'writers', 'index.md'))]).first;
  assert.deepEqual(find(index, 'D5'), []);
});

test('D5: a broken Next on a catalog page is still a FAIL', () => {
  const { first } = run([doc(path.join('components', 'writers', 'gamma', 'index.md'))]);
  const f = find(first, 'D5');
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'FAIL');
  assert.match(f[0].msg, /not a page/);
});

test('catalog prefixes live in one exported constant in check.mjs', () => {
  // check.mjs is a CLI (it exits without pages), so the constant is read from the source.
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(src, /export const CATALOG_PREFIXES = \['\/components\/extractors\/', '\/components\/writers\/', '\/components\/applications\/'\];/);
});

test('--paths selects every page under a prefix', () => {
  const { out } = run(['--paths', 'src/content/docs/guide']);
  assert.equal(out.pages.length, 23);
});

test('text output names the rule, the level and the line', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', REPO, page('no-desc.md')], { encoding: 'utf8' });
  assert.match(r.stdout, /D1\s+FAIL/);
  assert.match(r.stdout, /D4\s+FAIL\s+:8/);
  assert.match(r.stdout, /verdict: FIX/);
});

test('D16: a TEMPLATE: leftover anywhere on the page is a FAIL with its line', () => {
  const { status, first } = run([page('template-left.md')]);
  assert.equal(status, 1);
  const d16 = find(first, 'D16');
  assert.equal(d16.length, 2);
  assert.deepEqual(d16.map((f) => f.line), [2, 13]);
  assert.ok(d16.every((f) => f.level === 'FAIL'));
});

test('--index reads the staged blob, not the working-tree file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-index-'));
  fs.cpSync(REPO, dir, { recursive: true });
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const g = (...a) => spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' });
  g('init', '-q'); g('add', '-A'); g('commit', '-q', '-m', 'base');
  const p = path.join(dir, page('clean-howto.md'));
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^Practical recipes.*$/m, '## Heading first'));   // unstaged: lede gone
  const at = (...a) => JSON.parse(spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json', ...a, page('clean-howto.md')], { encoding: 'utf8' }).stdout).pages[0];
  assert.ok(ids(at(), 'FAIL').includes('D3'), 'the working tree has no lede');
  assert.deepEqual(ids(at('--index'), 'FAIL'), [], 'the staged blob still has it');
});

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-ref-'));
  fs.cpSync(REPO, dir, { recursive: true });
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const g = (...a) => spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' });
  g('init', '-q'); g('add', '-A'); g('commit', '-q', '-m', 'base');
  const at = (file, ...a) => JSON.parse(spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json', ...a, file], { encoding: 'utf8' }).stdout).pages[0];
  return { dir, g, at };
}

test('--ref reads a page as it was in a commit', () => {
  const { dir, g, at } = tmpRepo();
  const base = g('rev-parse', 'HEAD').stdout.trim();
  const p = path.join(dir, page('clean-howto.md'));
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^Practical recipes.*$/m, '## Heading first'));
  g('commit', '-q', '-am', 'break the lede');
  assert.ok(ids(at(page('clean-howto.md')), 'FAIL').includes('D3'), 'HEAD has no lede');
  assert.deepEqual(ids(at(page('clean-howto.md'), '--ref', base), 'FAIL'), [], 'the base commit still has it');
});

test('D9: a VERIFY mentioned inside the type marker is not a marker; a placeholder owner is', () => {
  const { dir, at } = tmpRepo();
  const p = path.join(dir, page('clean-howto.md'));
  const text = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, text.replace('Fixture page used by check.test.mjs.', 'Fixture page; no VERIFY left on it.'));
  assert.deepEqual(find(at(page('clean-howto.md')), 'D9'), []);
  for (const owner of ['storage-owner', 'owner-storage', 'someone', 'team']) {
    fs.writeFileSync(p, text.replace('## Set the guide up', `<!-- VERIFY(${owner}): check it -->\n\n## Set the guide up`));
    assert.equal(find(at(page('clean-howto.md')), 'D9').length, 1, owner);
  }
  fs.writeFileSync(p, text.replace('## Set the guide up', '<!-- VERIFY(Jiří Soukup): check it -->\n\n## Set the guide up'));
  assert.deepEqual(find(at(page('clean-howto.md')), 'D9'), []);
});
