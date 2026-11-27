#!/usr/bin/env node
// Prove that a schema change touched copy only. Compares two versions of a
// configSchema.json or configRowSchema.json and fails if any leaf changed
// outside the copy whitelist: title, description, options.tooltip,
// options.documentation (and below), options.enum_titles (and below), and a
// propertyOrder added where none was set.
//
// The schemas drive the live configuration form and reach every stack within
// about five minutes of the Developer Portal update, so a moved `enum`,
// `required`, `default` or `type` breaks customers' UI. Run it on every schema
// in a PR: `schema-diff.mjs <before.json> <after.json>`.
// Exit 0 = copy-only change, 1 = a functional leaf changed, 2 = could not run.

import { readFileSync } from 'node:fs';

const [before, after] = process.argv.slice(2);
if (!before || !after) {
  console.error('usage: schema-diff.mjs <before.json> <after.json>');
  process.exit(2);
}
const load = (p) => {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) {
    console.error(`RESULT: could not read ${p}: ${e.message}`); process.exit(2);
  }
};
const a = load(before), b = load(after);

// A changed path is allowed when its last segments name a copy leaf.
const ALLOWED = [
  /(^|\.)title$/,
  /(^|\.)description$/,
  /(^|\.)options\.tooltip$/,
  /(^|\.)options\.documentation(\..+)?$/,
  /(^|\.)options\.enum_titles(\.\d+)?$/,
];
// A field that happens to be named `title` or `description` sits directly under
// `properties`; adding or removing it is a form change, not copy.
const allowed = (path) =>
  path.split('.').at(-2) !== 'properties' && ALLOWED.some((re) => re.test(path));

const changes = [];
const added = []; // missing propertyOrder added: allowed, unlike a changed one
function leaves(node, path) {
  if (node && typeof node === 'object') {
    const keys = Object.keys(node);
    if (!keys.length) { changes.push(path); return; }
    for (const k of keys) leaves(node[k], `${path}.${k}`);
  } else changes.push(path);
}
function walk(x, y, path) {
  const tx = Array.isArray(x) ? 'array' : x === null ? 'null' : typeof x;
  const ty = Array.isArray(y) ? 'array' : y === null ? 'null' : typeof y;
  if (tx !== ty) { changes.push(path || '(root)'); return; }
  if (tx === 'object') {
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in x) || !(k in y)) {
        // An added or removed subtree is judged by its leaves, so adding an
        // `options` object that holds only a tooltip counts as copy.
        const sub = k in x ? x[k] : y[k];
        // Only an `options` object (or a subtree inside one, like
        // `documentation`) is judged leaf by leaf; any other added or removed
        // object (`items`, `properties`, a nested schema) changes the form.
        const inOptions = k === 'options' || path.split('.').includes('options');
        if (k === 'propertyOrder' && !(k in x)) added.push(p); // adding a missing one is allowed
        else if (sub && typeof sub === 'object' && inOptions && path.split('.').at(-1) !== 'properties') leaves(sub, p);
        else changes.push(p);
      } else walk(x[k], y[k], p);
    }
  } else if (tx === 'array') {
    if (x.length !== y.length) { changes.push(path); return; }
    x.forEach((v, i) => walk(v, y[i], `${path}.${i}`));
  } else if (x !== y) changes.push(path);
}
walk(a, b, '');

const bad = changes.filter((p) => !allowed(p));
for (const p of changes) console.log(`${allowed(p) ? 'copy   ' : 'BLOCKED'} ${p}`);
for (const p of added) console.log(`order   ${p} (added where it was missing)`);
console.log(`\nRESULT: ${changes.length + added.length} changed path(s), ${bad.length} outside the copy whitelist`);
if (bad.length) process.exitCode = 1;
