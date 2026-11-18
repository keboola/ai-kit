// Self-checks for the component-copy linter and schema guard, on the bundled fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, '..', 'fixtures');
const run = (script, ...args) =>
  spawnSync(process.execPath, [join(HERE, script), ...args], { encoding: 'utf8' });

test('lint passes the clean fixture with schemas', () => {
  const r = run('lint-copy.mjs', join(FIX, 'clean'), '--schemas');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('lint finds 9 errors and 4 warnings in the broken fixture', () => {
  const r = run('lint-copy.mjs', join(FIX, 'broken'), '--schemas');
  assert.notEqual(r.status, 0);
  const out = r.stdout + r.stderr;
  assert.match(out, /\b9 errors?\b/, out);
  assert.match(out, /\b4 warnings?\b/, out);
});

test('schema-diff accepts a copy-only change', () => {
  const r = run('schema-diff.mjs', join(FIX, 'schema-diff', 'before.json'), join(FIX, 'schema-diff', 'after-copy.json'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('schema-diff blocks a functional change', () => {
  const r = run('schema-diff.mjs', join(FIX, 'schema-diff', 'before.json'), join(FIX, 'schema-diff', 'after-functional.json'));
  assert.notEqual(r.status, 0);
});

// House rules agreed 2026-11-12, reshaped on the owner's review: load behaviour in the long
// description, Prerequisites in the README, configuration description optional, no images in copy.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const proposal = (files) => {
  const d = mkdtempSync(join(tmpdir(), 'cc-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(d, name), text);
  return d;
};
const PREREQS = '## Prerequisites\n\n- Account and plan: A HubSpot account; no paid plan needed.\n- Access: A private app token.\n- Permissions: Read scopes for contacts and deals.\n- Network: No network setup needed.\n- Set up first: A private app in HubSpot.\n';
const README_OK = `# HubSpot\n\n${PREREQS}\n## Configuration\n\nPick the endpoints.\n`;
const LONG_OK = 'Reads contacts and deals into Storage tables.\n\nIncremental loading is not supported; every run is a full load.\n';

test('a connector long description without load behaviour fails, VERIFY about loading passes', () => {
  const bad = proposal({ 'component_long_description.md': 'Reads contacts and deals into Storage tables.\n' });
  assert.equal(run('lint-copy.mjs', bad, '--bucket', 'source/saas-api').status, 1);
  assert.equal(run('lint-copy.mjs', bad, '--bucket', 'processor').status, 0);
  const verify = proposal({ 'component_long_description.md': 'Reads contacts.\n\nVERIFY(owner): is loading incremental?\n' });
  assert.equal(run('lint-copy.mjs', verify, '--bucket', 'source/saas-api').status, 0);
});

test('the configuration description is optional; text in it still follows the published rules', () => {
  assert.equal(run('lint-copy.mjs', proposal({ 'configuration_description.md': '  \n' })).status, 0);
  const full = proposal({
    'component_short_description.md': 'CRM platform for marketing, sales and service teams.\n',
    'component_long_description.md': LONG_OK,
    'documentationUrl.md': 'https://github.com/keboola/component-hubspot-v2/blob/main/README.md\n',
  });
  assert.equal(run('lint-copy.mjs', full, '--full').status, 0, 'no configuration_description.md is fine');
  assert.equal(run('lint-copy.mjs', proposal({ 'configuration_description.md': '## Setup\n\nText.\n' })).status, 1);
});

test('any image in the copy the UI shows fails, wherever it is hosted', () => {
  for (const img of ['![a](docs/imgs/a.png)', '![a](https://help.keboola.com/a.png)', '![a][ref]', '<img src="https://i.ibb.co/a.png">']) {
    const d = proposal({ 'configuration_description.md': `Where the token comes from.\n\n${img}\n` });
    const r = run('lint-copy.mjs', d);
    assert.equal(r.status, 1, img);
    assert.match(r.stdout, /house#images/);
  }
});

test('a prerequisites block in the long description fails: it belongs in the README', () => {
  const r = run('lint-copy.mjs', proposal({ 'component_long_description.md': `Reads contacts.\n\n### Before you start\n\n- Access: a token\n\n${LONG_OK}` }), '--connector');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /house#prerequisites-in-readme/);
});

test('a connector README needs all five Prerequisites items, filled and in order', () => {
  const lint = (readme) => run('lint-copy.mjs', proposal({ 'component_long_description.md': LONG_OK, 'README.md': readme }), '--bucket', 'destination/database');
  assert.equal(lint(README_OK).status, 0, lint(README_OK).stdout);
  assert.equal(run('lint-copy.mjs', fixtureClean(), '--schemas', '--bucket', 'source/database').status, 0);
  const none = lint('# X\n\nNothing here.\n');
  assert.equal(none.status, 1);
  assert.match(none.stdout, /No "## Prerequisites" section/);
  assert.match(lint(README_OK.replace('- Network: No network setup needed.\n', '')).stdout, /no "- Network:" item/);
  assert.match(lint(README_OK.replace('- Access: A private app token.', '- Access:')).stdout, /"- Access:" is empty/);
  assert.match(lint(README_OK.replace('- Account and plan: A HubSpot account; no paid plan needed.\n- Access: A private app token.', '- Access: A private app token.\n- Account and plan: A HubSpot account; no paid plan needed.')).stdout, /out of order/);
  assert.equal(lint(README_OK.replace('No network setup needed.', 'VERIFY(owner): IP allow-list?')).status, 0);
  const ext = proposal({ 'component_long_description.md': LONG_OK, 'README.md': README_OK });
  const other = proposal({ 'r.md': '# X\n' });
  assert.equal(run('lint-copy.mjs', ext, '--connector', '--readme', join(other, 'r.md')).status, 1, '--readme wins over README.md');
  assert.equal(run('lint-copy.mjs', proposal({ 'component_long_description.md': LONG_OK }), '--connector').status, 0, 'no README at hand: rule skipped');
  assert.equal(run('lint-copy.mjs', proposal({ 'README.md': '# X\n' }), '--bucket', 'application').status, 0, 'applications: recommended only');
});

const fixtureClean = () => join(FIX, 'clean');

// component-update / component-retire / audit / CI support (2026-11-12).
test('--connector applies connector rules without a bucket; --retired needs the deprecation line', () => {
  const plain = proposal({ 'component_long_description.md': 'Reads contacts.\n' });
  assert.equal(run('lint-copy.mjs', plain, '--connector').status, 1);
  assert.equal(run('lint-copy.mjs', plain).status, 0);
  const notMarked = run('lint-copy.mjs', plain, '--connector', '--retired');
  assert.equal(notMarked.status, 1);
  assert.match(notMarked.stdout, /house#retired/);
  assert.doesNotMatch(notMarked.stdout, /before-you-start|load-behaviour/);
  const marked = proposal({
    'component_long_description.md': 'Deprecated: use [HubSpot v2](https://example.com) instead.\n\nReads contacts.\n',
    'configuration_description.md': 'Deprecated: use HubSpot v2 instead.\n',
  });
  assert.equal(run('lint-copy.mjs', marked, '--connector', '--retired').status, 0);
});

const fakeIndex = () => proposal({
  'storage.json': JSON.stringify({ components: [
    { id: 'x.ex-good', name: 'Good', type: 'extractor', description: 'CRM platform.', longDescription: LONG_OK, configurationDescription: 'Paste the token. The first run creates one table per object.', documentationUrl: 'https://example.com' },
    { id: 'x.ex-empty', name: 'Empty', type: 'extractor', description: 'CRM platform.', longDescription: '', configurationDescription: '' },
    { id: 'x.ex-hidden', name: 'Hidden', type: 'extractor', flags: ['deprecated'], description: '' },
  ] }),
  'README.md': '# X\n\n## Supported Endpoints\n\n* Contacts\n* Invoices\n\n### Fetch Mode values\n\n* full_fetch\n\n## Prerequisites\n\nA private app token.\n',
});

test('audit ranks the empty component first and skips hidden ones', () => {
  const d = fakeIndex();
  const r = run('audit.mjs', '--index', join(d, 'storage.json'), '--json');
  assert.equal(r.status, 0, r.stderr);
  const res = JSON.parse(r.stdout);
  assert.equal(res.components, 2);
  assert.equal(res.passing, 1);
  assert.equal(res.rows[0].id, 'x.ex-empty');
});

test('drift names README items the long description misses, not option values', () => {
  const d = fakeIndex();
  const r = run('drift.mjs', 'x.ex-good', '--repo', 'x/y', '--index', join(d, 'storage.json'), '--readme', join(d, 'README.md'));
  const res = JSON.parse(r.stdout);
  assert.deepEqual(res.readmeItems, ['Invoices']);
  assert.equal(res.prerequisites.heading, 'Prerequisites');
  assert.equal(r.status, 1);
});

test('schema-copy sets copy leaves, refuses functional ones', () => {
  const d = proposal({
    'schema.json': JSON.stringify({ type: 'object', properties: { mode: { type: 'string', title: 'Mode', enum: ['a', 'b'], propertyOrder: 1 } } }, null, 2) + '\n',
    'ok.json': JSON.stringify({ 'root.mode': { title: 'Fetch mode', 'options.tooltip': 'How much a run reads.', 'options.enum_titles': ['All', 'Changed only'] } }),
    'bad.json': JSON.stringify({ 'root.mode': { default: 'b' } }),
    'short.json': JSON.stringify({ 'root.mode': { 'options.enum_titles': ['All'] } }),
  });
  const ok = run('schema-copy.mjs', join(d, 'schema.json'), join(d, 'ok.json'));
  assert.equal(ok.status, 0, ok.stderr);
  const out = JSON.parse(ok.stdout);
  assert.equal(out.properties.mode.title, 'Fetch mode');
  assert.deepEqual(out.properties.mode.options.enum_titles, ['All', 'Changed only']);
  assert.equal(run('schema-copy.mjs', join(d, 'schema.json'), join(d, 'bad.json')).status, 1);
  assert.equal(run('schema-copy.mjs', join(d, 'schema.json'), join(d, 'short.json')).status, 1);
});

// Review fixes, 2026-11-12.
test('an empty long description on a connector fails the load rule', () => {
  const r = run('lint-copy.mjs', proposal({ 'component_long_description.md': '\n' }), '--connector');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /house#load-behaviour/);
});

test('a VERIFY about something else does not count as the load line', () => {
  const r = run('lint-copy.mjs', proposal({ 'component_long_description.md': 'Reads contacts.\n\nVERIFY(owner): which tables does a run create?\n' }), '--connector');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /house#load-behaviour/);
});

test('schema-copy addresses a property named items and array items with []', () => {
  const d = proposal({
    'schema.json': JSON.stringify({ type: 'object', properties: {
      items: { type: 'string', title: 'Items', propertyOrder: 1 },
      rows: { type: 'array', propertyOrder: 2, items: { type: 'object', properties: { name: { type: 'string', title: 'Name', propertyOrder: 1 } } } },
    } }, null, 2) + '\n',
    'edits.json': JSON.stringify({ 'root.items': { title: 'Objects' }, 'root.rows[].name': { title: 'Row name' } }),
  });
  const r = run('schema-copy.mjs', join(d, 'schema.json'), join(d, 'edits.json'));
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.properties.items.title, 'Objects');
  assert.equal(out.properties.rows.items.properties.name.title, 'Row name');
});

test('drift exits 2 when the index cannot be read', () => {
  const r = run('drift.mjs', 'x.ex-good', '--repo', 'x/y', '--index', join(tmpdir(), 'no-such-index.json'));
  assert.equal(r.status, 2, r.stderr);
});

import { mentionsExactly, declaresExactly, nearestRoot, parseGithubUrl, monorepoCandidates, decideLocation, MONOREPOS } from './lib/locate.mjs';
const [MONOREPO, PRIVATE] = MONOREPOS;

test('an id matches exactly, never inside a longer id', () => {
  assert.ok(mentionsExactly('cd kds-team.ex-hubspot-v2', 'kds-team.ex-hubspot-v2'));
  assert.ok(mentionsExactly('see kds-team.ex-hubspot.', 'kds-team.ex-hubspot'));
  assert.ok(!mentionsExactly('cd kds-team.ex-hubspot-v2', 'kds-team.ex-hubspot'));
  assert.ok(!mentionsExactly('x.kds-team.ex-hubspot', 'kds-team.ex-hubspot'));
  assert.ok(declaresExactly('KBC_DEVELOPERPORTAL_APP: "kds-team.ex-hubspot-v2"', 'kds-team.ex-hubspot-v2'));
  assert.ok(declaresExactly('"componentId": "x.ex-y"', 'x.ex-y'));
  assert.ok(!declaresExactly('KBC_DEVELOPERPORTAL_APP: "x.ex-y-v2"', 'x.ex-y'));
  assert.ok(!declaresExactly('This replaces x.ex-y.', 'x.ex-y'));
});

test('a hit belongs to the deepest component folder above it, or to none', () => {
  const roots = ['components/a', 'components/a/sub', 'components/b'];
  assert.equal(nearestRoot('components/a/README.md', roots), 'components/a');
  assert.equal(nearestRoot('components/a/.github/workflows/push.yml', roots), 'components/a');
  assert.equal(nearestRoot('components/a/sub/x.json', roots), 'components/a/sub');
  assert.equal(nearestRoot('README.md', roots), null);
  assert.equal(nearestRoot('components/ab/README.md', roots), null);
});

test('documentation URLs give the repo and the folder', () => {
  assert.deepEqual(parseGithubUrl('https://github.com/keboola/component-x/blob/main/README.md'), { repo: 'keboola/component-x', path: '' });
  assert.deepEqual(parseGithubUrl('https://github.com/keboola/components/tree/main/components/x'), { repo: MONOREPO, path: 'components/x' });
  assert.deepEqual(parseGithubUrl('https://github.com/keboola/components/blob/main/components/x/README.md#setup'), { repo: MONOREPO, path: 'components/x' });
  assert.equal(parseGithubUrl('https://help.keboola.com/x'), null);
});

const ID = 'kds-team.ex-hubspot-v2';
const ROOTS = ['components/hubspot', 'components/hubspot-v2'];
const hit = (path, fragment) => ({ path, fragments: [fragment] });

test('monorepo candidates: one component counts once, mentions never beat declarations', () => {
  const c = monorepoCandidates([
    hit('components/hubspot-v2/README.md', 'cd kds-team.ex-hubspot-v2'),
    hit('components/hubspot-v2/.github/workflows/push.yml', 'KBC_DEVELOPERPORTAL_APP: "kds-team.ex-hubspot-v2"'),
    hit('README.md', '| kds-team.ex-hubspot-v2 |'),
  ], ROOTS, ID);
  assert.deepEqual(c, { declared: ['components/hubspot-v2'], mentioned: [] });
  const v1 = monorepoCandidates([hit('components/hubspot-v2/README.md', 'replaces kds-team.ex-hubspot and adds')], ROOTS, 'kds-team.ex-hubspot');
  assert.deepEqual(v1, { declared: [], mentioned: ['components/hubspot-v2'] });
});

const readable = (over = {}) => ({ repo: MONOREPO, readable: true, roots: ROOTS, declared: [], mentioned: [], truncated: false, searchError: null, ...over });
const levels = (d) => ({ kind: d.location?.kind ?? null, folder: d.location?.folder ?? null, hard: d.hard.length });

test('decideLocation: moved, declared once, goes to the monorepo folder', () => {
  const d = decideLocation({ id: ID, docRepo: { repo: 'keboola/component-hubspot-v2', archived: true }, monos: [readable({ declared: ['components/hubspot-v2'] })] });
  assert.deepEqual(levels(d), { kind: 'monorepo', folder: 'components/hubspot-v2', hard: 0 });
  assert.equal(d.location.predecessor, 'keboola/component-hubspot-v2');
});

test('decideLocation: a mention alone never picks a folder; --folder does, if it is a component folder', () => {
  const monos = [readable({ mentioned: ['components/hubspot-v2'] })];
  const d = decideLocation({ id: 'kds-team.ex-hubspot', docRepo: { repo: 'keboola/component-hubspot', archived: true }, monos });
  assert.deepEqual(levels(d), { kind: null, folder: null, hard: 1 });
  assert.match(d.hard[0], /only mentioned/);
  assert.equal(levels(decideLocation({ id: ID, monos, folder: 'components/hubspot-v2' })).kind, 'monorepo');
  assert.match(decideLocation({ id: ID, monos, folder: 'docs' }).hard[0], /not a component folder/);
});

test('decideLocation: the documentation folder settles it when nothing declares the id', () => {
  const d = decideLocation({ id: ID, docUrl: parseGithubUrl('https://github.com/keboola/components/tree/main/components/hubspot-v2'), monos: [readable()] });
  assert.deepEqual(levels(d), { kind: 'monorepo', folder: 'components/hubspot-v2', hard: 0 });
});

test('decideLocation: failures are reported as failures, not as answers', () => {
  const pred = { repo: 'keboola/component-hubspot-v2', archived: true };
  const noAccess = decideLocation({ id: ID, docRepo: pred, monos: [{ repo: MONOREPO, readable: false, error: 'HTTP 403: Resource protected by organization SAML enforcement' }] });
  assert.match(noAccess.hard[0], /SAML/);
  assert.equal(noAccess.predecessor, 'keboola/component-hubspot-v2');
  const searchDown = decideLocation({ id: ID, docRepo: pred, monos: [readable({ searchError: 'HTTP 403: API rate limit exceeded' })] });
  assert.match(searchDown.hard[0], /search .* failed .*rate limit.*re-run/);
  assert.match(decideLocation({ id: ID, docRepo: pred, monos: [readable()] }).hard[0], /has no folder that declares/);
});

test('decideLocation: several declaring folders or a half-done move stop hard', () => {
  assert.match(decideLocation({ id: ID, monos: [readable({ declared: ROOTS })] }).hard[0], /2 monorepo folders/);
  const half = decideLocation({ id: ID, standalone: [{ repo: 'keboola/component-hubspot-v2', archived: false }], monos: [readable({ declared: ['components/hubspot-v2'] })] });
  assert.match(half.hard[0], /half done/);
});

test('decideLocation: a live standalone repo, or the documentation repo as a last resort', () => {
  const live = decideLocation({ id: 'x.ex-y', standalone: [{ repo: 'keboola/component-y', archived: false }], monos: [{ repo: MONOREPO, readable: false, error: 'HTTP 404' }] });
  assert.deepEqual(levels(live), { kind: 'repo', folder: '', hard: 0 });
  const doc = decideLocation({ id: 'x.ex-y', docRepo: { repo: 'keboola/docs-y', archived: false }, monos: [{ repo: MONOREPO, readable: false, error: 'HTTP 404' }] });
  assert.match(doc.location.source, /unverified/);
  const none = decideLocation({ id: 'x.ex-y', monos: [{ repo: MONOREPO, readable: false, error: 'HTTP 404' }] });
  assert.match(none.hard[0], /Could not resolve.*404/);
});

// component-facts end to end, offline: a stub gh on PATH and a one-component index.
import { chmodSync } from 'node:fs';
const factsRun = (answers, id = ID) => {
  const dir = mkdtempSync(join(tmpdir(), 'facts-'));
  writeFileSync(join(dir, 'answers.json'), JSON.stringify(answers));
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${join(FIX, 'facts', 'gh-stub.mjs')}" "$@"\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ components: [{
    id, name: 'HubSpot v2', type: 'extractor', flags: ['genericDockerUI', 'genericDockerUI-rows'],
    description: 'CRM platform.', longDescription: 'Loads CRM data.', configurationDescription: '',
    documentationUrl: 'https://github.com/keboola/component-hubspot-v2/blob/main/README.md', configurationSchema: { a: 1 },
  }] }));
  const r = spawnSync(process.execPath, [join(HERE, 'component-facts.mjs'), id, '--index', join(dir, 'index.json')], {
    encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GH_STUB_ANSWERS: join(dir, 'answers.json') },
  });
  return { status: r.status, facts: r.stdout ? JSON.parse(r.stdout) : null, stderr: r.stderr };
};
const b64 = (s) => Buffer.from(s).toString('base64');
const MOVED = {
  [`search:org:keboola org:keboola-rnd "KBC_DEVELOPERPORTAL_APP" "${ID}" path:.github/workflows`]: { total: 0, incomplete: false, items: [] },
  'repos/keboola/component-hubspot-v2': { b: 'main', p: '2026-08-13T12:34:37Z', a: true },
  'repos/keboola/components': { b: 'main', push: false },
  'repos/keboola/components/git/trees/main?recursive=1': { truncated: false, roots: ['', 'components/hubspot', 'components/hubspot-v2'] },
  [`search:repo:keboola/components "${ID}"`]: { total: 3, incomplete: false, items: [
    { repo: MONOREPO, path: 'components/hubspot-v2/README.md', fragments: [`cd ${ID}`] },
    { repo: MONOREPO, path: 'components/hubspot-v2/.github/workflows/push.yml', fragments: [`KBC_DEVELOPERPORTAL_APP: "${ID}"`] },
    { repo: MONOREPO, path: 'README.md', fragments: [`| ${ID} |`] },
  ] },
  'repos/keboola/components/contents/components/hubspot-v2/component_config': ['component_long_description.md', 'configSchema.json'],
  'repos/keboola/components/contents/.github/workflows': ['ci.yml', 'publish.yml'],
  'repos/keboola/components/contents/.github/workflows/ci.yml': b64('jobs:\n  ci:\n    uses: keboola/component-ci/.github/workflows/monorepo-ci.yml@master\n'),
  'repos/keboola/components/contents/.github/workflows/publish.yml': b64('jobs:\n  publish:\n    uses: keboola/component-ci/.github/workflows/monorepo-publish.yml@master\n    with:\n      PUBLISH_ENABLED: true\n'),
};

test('facts: a moved component resolves to its monorepo folder and reads the publish caller', () => {
  const { facts, stderr } = factsRun(MOVED);
  assert.ok(facts, stderr);
  assert.equal(facts.repo, MONOREPO);
  assert.equal(facts.folder, 'components/hubspot-v2');
  assert.equal(facts.predecessor, 'keboola/component-hubspot-v2');
  assert.equal(facts.publish.trigger, 'monorepo');
  assert.match(facts.publish.triggerVia, /publish\.yml.*PUBLISH_ENABLED: true/);
  assert.deepEqual(facts.publish.componentConfigDir, ['component_long_description.md', 'configSchema.json']);
  assert.equal(facts.gate.level, 'soft', facts.gate.reasons.join('\n'));
  assert.ok(facts.gate.reasons.some((r) => /cannot push/.test(r)));
});

test('facts: a failed monorepo search or an SSO refusal is reported as such', () => {
  const down = factsRun({ ...MOVED, [`search:repo:keboola/components "${ID}"`]: { __error: 'gh: API rate limit exceeded (HTTP 403)' } });
  assert.equal(down.facts.gate.level, 'hard');
  assert.ok(down.facts.gate.reasons.some((r) => /search in keboola\/components failed.*rate limit/.test(r)), down.facts.gate.reasons.join('\n'));
  const sso = factsRun({ ...MOVED, 'repos/keboola/components': { __error: 'gh: Resource protected by organization SAML enforcement (HTTP 403)' } });
  assert.ok(sso.facts.gate.reasons.some((r) => /SAML/.test(r)));
  assert.equal(sso.facts.predecessor, 'keboola/component-hubspot-v2');
});

test('facts: PUBLISH_ENABLED false is not reported as a publishing monorepo', () => {
  const off = factsRun({ ...MOVED, 'repos/keboola/components/contents/.github/workflows/publish.yml': b64('    uses: keboola/component-ci/.github/workflows/monorepo-publish.yml@master\n    with:\n      PUBLISH_ENABLED: false\n') });
  assert.equal(off.facts.publish.trigger, 'unknown');
});

test('decideLocation: two monorepos, the folder can be in either, and an unreadable one is named', () => {
  const pub = readable();
  const priv = readable({ repo: PRIVATE, roots: ['components/hubspot-v2'], declared: ['components/hubspot-v2'] });
  const d = decideLocation({ id: ID, monos: [pub, priv] });
  assert.deepEqual([d.location.repo, d.location.folder], [PRIVATE, 'components/hubspot-v2']);
  const both = decideLocation({ id: ID, monos: [readable({ declared: ['components/hubspot-v2'] }), priv] });
  assert.match(both.hard[0], /2 monorepo folders.*keboola\/components\/components\/hubspot-v2.*keboola\/components-private/);
  const sameName = decideLocation({ id: ID, monos: [pub, priv], folder: 'components/hubspot-v2' });
  assert.match(sameName.hard[0], /<owner\/monorepo>:components\/hubspot-v2/);
  assert.equal(decideLocation({ id: ID, monos: [pub, priv], folder: `${PRIVATE}:components/hubspot-v2` }).location.repo, PRIVATE);
  const half = decideLocation({ id: ID, monos: [readable({ declared: ['components/hubspot-v2'] }), { repo: PRIVATE, readable: false, error: 'HTTP 404' }] });
  assert.ok(half.notes.some((n) => /components-private could not be read/.test(n)));
  const none = decideLocation({ id: ID, docRepo: { repo: 'keboola/component-hubspot-v2', archived: true }, monos: [pub, { repo: PRIVATE, readable: false, error: 'HTTP 404' }] });
  assert.match(none.hard[0], /components-private could not be read.*keboola\/components has no folder/);
});

test('facts: a component that lives in the private monorepo resolves there', () => {
  const priv = {
    ...MOVED,
    [`search:repo:keboola/components "${ID}"`]: { total: 0, incomplete: false, items: [] },
    'repos/keboola/components-private': { b: 'main', push: true },
    'repos/keboola/components-private/git/trees/main?recursive=1': { truncated: false, roots: ['hubspot-v2'] },
    [`search:repo:keboola/components-private "${ID}"`]: { total: 1, incomplete: false, items: [
      { repo: PRIVATE, path: 'hubspot-v2/component.yaml', fragments: [`id: ${ID}`] },
    ] },
    'repos/keboola/components-private/contents/hubspot-v2/component_config': ['component_long_description.md'],
    'repos/keboola/components-private/contents/.github/workflows': ['publish.yml'],
    'repos/keboola/components-private/contents/.github/workflows/publish.yml': MOVED['repos/keboola/components/contents/.github/workflows/publish.yml'],
  };
  const { facts, stderr } = factsRun(priv);
  assert.ok(facts, stderr);
  assert.deepEqual([facts.repo, facts.folder], [PRIVATE, 'hubspot-v2']);
  assert.equal(facts.publish.trigger, 'monorepo');
  assert.ok(!facts.gate.reasons.some((r) => /cannot push/.test(r)));
});
