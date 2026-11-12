#!/usr/bin/env node
// Fleet audit: runs the house rules (lint-copy.mjs) over the live copy of every public
// component and says what to fix first. Read-only; writes only where --out points.
//
//   node audit.mjs                       live index from connection.keboola.com, markdown report
//   node audit.mjs --index <file.json>   a saved /v2/storage response instead of the live one
//   node audit.mjs --json                machine-readable result
//   node audit.mjs --out <file>          write the report to a file as well
//
// Priority, highest first: an empty short or long description, an image in the copy, a connector
// without a load-behaviour line, then everything else. The README's Prerequisites section is not
// in the Storage index, so the audit cannot judge it: drift.mjs and the component CI do, per repo. Schema findings are warnings here: the audit judges
// the copy, and a schema change is its own reviewed PR.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isVisible } from './lib/visible.mjs';
import { lintCopy } from './lint-copy.mjs';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REFS = process.env.COMPONENT_COPY_REFS || join(SKILL_DIR, 'references');
const STORAGE = 'https://connection.keboola.com/v2/storage';

const argv = process.argv.slice(2);
const val = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };

const index = val('--index')
  ? JSON.parse(readFileSync(val('--index'), 'utf8'))
  : await (async () => {
    const res = await fetch(STORAGE, { headers: { accept: 'application/json' } });
    if (!res.ok) { console.error(`RESULT: ${STORAGE} answered ${res.status}`); process.exit(2); }
    return res.json();
  })();

const buckets = new Map(
  JSON.parse(readFileSync(join(REFS, 'category-map.json'), 'utf8')).rows.map((r) => [r.id, r.bucket]),
);

const text = (v) => (typeof v === 'string' ? v : '');
const schema = (o) => (o && typeof o === 'object' && Object.keys(o).length ? JSON.stringify(o) : null);

const PRIORITY = [
  ['empty field', (f) => /is empty|is missing/i.test(f.message) && /description/.test(f.file)],
  ['image', (f) => f.rule === 'house#images'],
  ['load behaviour', (f) => f.rule === 'house#load-behaviour'],
];
const rank = (f) => {
  const i = PRIORITY.findIndex(([, test]) => test(f));
  return i < 0 ? PRIORITY.length : i;
};

const rows = [];
for (const c of index.components || []) {
  if (!isVisible(c)) continue;
  const files = {
    'component_short_description.md': text(c.description),
    'component_long_description.md': text(c.longDescription),
    'configuration_description.md': text(c.configurationDescription),
    'documentationUrl.md': text(c.documentationUrl) || null,
    'configSchema.json': schema(c.configurationSchema),
    'configRowSchema.json': schema(c.configurationRowSchema),
  };
  const bucket = buckets.get(c.id) || null;
  const connector = !bucket && (c.type === 'extractor' || c.type === 'writer');
  const findings = lintCopy((name) => files[name] ?? null, { full: true, name: c.name, bucket, connector })
    .filter((f) => !/Schema\.json$/.test(f.file));
  const errors = findings.filter((f) => f.level === 'error');
  rows.push({
    id: c.id,
    name: c.name,
    type: c.type,
    bucket,
    errors: errors.length,
    warnings: findings.length - errors.length,
    top: errors.length ? Math.min(...errors.map(rank)) : PRIORITY.length + 1,
    rules: [...new Set(errors.map((f) => f.rule))],
    findings,
  });
}

rows.sort((a, b) => a.top - b.top || b.errors - a.errors || a.id.localeCompare(b.id));
const passing = rows.filter((r) => !r.errors).length;
const byRule = {};
for (const r of rows) for (const rule of r.rules) byRule[rule] = (byRule[rule] || 0) + 1;
const byBucket = {};
for (const r of rows) {
  const b = r.bucket || `(unmapped ${r.type})`;
  byBucket[b] ??= { components: 0, passing: 0 };
  byBucket[b].components += 1;
  if (!r.errors) byBucket[b].passing += 1;
}

const result = {
  auditedAt: new Date().toISOString(),
  source: val('--index') || STORAGE,
  components: rows.length,
  passing,
  byRule,
  byBucket,
  rows,
};

let out;
if (argv.includes('--json')) {
  out = JSON.stringify(result, null, 2);
} else {
  const lines = [
    `# Component copy audit, ${result.auditedAt.slice(0, 10)}`,
    '',
    `${passing} of ${rows.length} public components pass every house rule.`,
    '',
    '## Components failing each rule',
    '',
    '| Rule | Components |',
    '|---|---|',
    ...Object.entries(byRule).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| \`${k}\` | ${v} |`),
    '',
    '## By bucket',
    '',
    '| Bucket | Components | Passing |',
    '|---|---|---|',
    ...Object.entries(byBucket).sort().map(([k, v]) => `| ${k} | ${v.components} | ${v.passing} |`),
    '',
    '## Fix first',
    '',
    'Ordered by the worst finding: an empty short or long description, then images, then load behaviour. README prerequisites are checked per repo (drift.mjs, component CI), not here.',
    '',
    '| Component | Bucket | Errors | Rules |',
    '|---|---|---|---|',
    ...rows.filter((r) => r.errors).slice(0, 50)
      .map((r) => `| \`${r.id}\` | ${r.bucket || r.type} | ${r.errors} | ${r.rules.map((x) => `\`${x}\``).join(', ')} |`),
  ];
  out = lines.join('\n') + '\n';
}
if (val('--out')) writeFileSync(val('--out'), out);
console.log(out);
console.error(`RESULT: ${passing}/${rows.length} public components pass; ${rows.length - passing} need work`);
