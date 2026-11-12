#!/usr/bin/env node
// Apply field-copy edits to a configSchema.json or configRowSchema.json and nothing else.
//
//   node schema-copy.mjs <schema.json> <edits.json> [--write] [--allow-reformat]
//
// edits.json maps a field path, written as lint-copy.mjs prints it, to the copy leaves to set:
//   { "root.fetch_settings.fetch_mode": {
//       "title": "Fetch mode",
//       "description": "Whether a run reads everything or only what changed",
//       "options.tooltip": "Incremental uses HubSpot's search API, which stops at 10,000 results.",
//       "options.enum_titles": ["Full fetch", "Incremental fetch"],
//       "options.documentation": { "link": "https://...", "tooltip": "..." } } }
// A path segment `items` steps into an array's item schema.
//
// Only title, description, options.tooltip, options.documentation and options.enum_titles can
// be set; anything else is refused. The file is re-serialised with its own indentation, and
// when that alone would change bytes the script stops (--allow-reformat accepts the noise).
// The result is then checked with schema-diff.mjs. Dry run unless --write: the new schema goes
// to stdout. Exit 0 = applied and copy-only, 1 = refused, 2 = could not run.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const [schemaPath, editsPath] = argv.filter((a) => !a.startsWith('--'));
if (!schemaPath || !editsPath) {
  console.error('usage: schema-copy.mjs <schema.json> <edits.json> [--write] [--allow-reformat]');
  process.exit(2);
}

const original = readFileSync(schemaPath, 'utf8');
const edits = JSON.parse(readFileSync(editsPath, 'utf8'));
const schema = JSON.parse(original);

const indentMatch = original.match(/^[\t ]+(?=")/m);
const indent = indentMatch ? indentMatch[0] : 2;
const eol = original.includes('\r\n') ? '\r\n' : '\n';
const serialise = (o) => JSON.stringify(o, null, indent).replace(/\n/g, eol) + (/\r?\n$/.test(original) ? eol : '');
if (serialise(schema) !== original && !argv.includes('--allow-reformat')) {
  console.error('RESULT: refused. Re-serialising this file changes bytes even without an edit, so the PR diff would carry formatting noise. Edit it by hand, or pass --allow-reformat and say so in the PR.');
  process.exit(1);
}

const SETTABLE = ['title', 'description', 'options.tooltip', 'options.documentation', 'options.enum_titles'];
const problems = [];

function field(path) {
  const parts = path.split('.');
  if (parts[0] !== 'root') return null;
  let node = schema;
  for (const p of parts.slice(1)) {
    node = p === 'items' ? node?.items : node?.properties?.[p];
    if (!node || typeof node !== 'object') return null;
  }
  return node;
}

for (const [path, leaves] of Object.entries(edits)) {
  const node = field(path);
  if (!node) { problems.push(`${path}: no such field`); continue; }
  for (const [key, value] of Object.entries(leaves)) {
    if (!SETTABLE.includes(key)) { problems.push(`${path}: "${key}" is not a copy leaf (allowed: ${SETTABLE.join(', ')})`); continue; }
    if (key === 'options.enum_titles') {
      if (!Array.isArray(node.enum)) { problems.push(`${path}: enum_titles on a field without enum`); continue; }
      if (!Array.isArray(value) || value.length !== node.enum.length) {
        problems.push(`${path}: enum_titles needs ${node.enum.length} entries, in enum order`); continue;
      }
    }
    if (key.startsWith('options.')) {
      node.options ??= {};
      node.options[key.slice('options.'.length)] = value;
    } else {
      node[key] = value;
    }
  }
}
if (problems.length) {
  for (const p of problems) console.error(`REFUSED ${p}`);
  console.error(`RESULT: refused, ${problems.length} problem(s); nothing written`);
  process.exit(1);
}

const updated = serialise(schema);
const tmp = join(mkdtempSync(join(tmpdir(), 'schema-copy-')), 'after.json');
writeFileSync(tmp, updated);
const diff = spawnSync(process.execPath, [join(HERE, 'schema-diff.mjs'), schemaPath, tmp], { encoding: 'utf8' });
process.stderr.write(diff.stdout);
if (diff.status !== 0) {
  console.error('RESULT: refused, schema-diff found a change outside the copy whitelist; nothing written');
  process.exit(1);
}
if (argv.includes('--write')) {
  writeFileSync(schemaPath, updated);
  console.error(`RESULT: ${schemaPath} updated, copy-only (schema-diff passed)`);
} else {
  process.stdout.write(updated);
  console.error('RESULT: dry run, copy-only (schema-diff passed); --write to apply');
}
