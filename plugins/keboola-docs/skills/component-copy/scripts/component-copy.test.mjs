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
