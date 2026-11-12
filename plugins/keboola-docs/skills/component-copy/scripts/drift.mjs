#!/usr/bin/env node
// What in one component's live copy is out of date or out of rule: the input for
// component-update. Read-only.
//
//   node drift.mjs <component.id> --repo <owner/name>
//   node drift.mjs <component.id> --repo <owner/name> --index <storage.json> --readme <README.md>
//
// The repo comes from component-facts.mjs (`repo`); --index and --readme replace the live
// fetches (tests, offline runs). Prints one JSON blob:
//   lint        house-rule findings on the live copy and the README's Prerequisites section (the
//               same rules as lint-copy.mjs)
//   verify      VERIFY(...) markers still in the live copy: questions the owner has not answered
//   readmeItems items the README lists under an endpoints/objects/reports heading that the long
//               description never names: candidates for "what you get", or the README is ahead
//   prerequisites the README's prerequisites section, as the source for "Before you start"
// Exit 0 = nothing to do, 1 = something to update, 2 = could not run.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintCopy } from './lint-copy.mjs';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REFS = process.env.COMPONENT_COPY_REFS || join(SKILL_DIR, 'references');
const STORAGE = 'https://connection.keboola.com/v2/storage';

const argv = process.argv.slice(2);
const val = (name) => { const i = argv.indexOf(name); const v = i > -1 ? argv[i + 1] : null; return v && !v.startsWith('--') ? v : null; };
const id = argv[0];
const repo = val('--repo');
if (!id || id.startsWith('--')) {
  console.error('usage: drift.mjs <component.id> --repo <owner/name> [--index <storage.json>] [--readme <README.md>] [--retired]');
  process.exit(2);
}

// Exit 2 when the index cannot be read: exit 1 means "something to update" and must not come from a
// network error.
let index;
try {
  if (val('--index')) index = JSON.parse(readFileSync(val('--index'), 'utf8'));
  else {
    const res = await fetch(STORAGE, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`${STORAGE} answered ${res.status}`);
    index = await res.json();
  }
} catch (e) {
  console.error(`RESULT: could not read the component index: ${e.message}`);
  process.exit(2);
}
const c = (index.components || []).find((x) => x.id === id);
if (!c) { console.error(`RESULT: ${id} is not in the Storage component index`); process.exit(2); }

let readme = null;
if (val('--readme')) readme = readFileSync(val('--readme'), 'utf8');
else if (repo) {
  try {
    readme = execFileSync('gh', ['api', `repos/${repo}/readme`, '-H', 'Accept: application/vnd.github.raw'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch { readme = null; }
}

const text = (v) => (typeof v === 'string' ? v : '');
const files = {
  'component_short_description.md': text(c.description),
  'component_long_description.md': text(c.longDescription),
  'configuration_description.md': text(c.configurationDescription),
  'documentationUrl.md': text(c.documentationUrl) || null,
};
let bucket = null;
try {
  bucket = JSON.parse(readFileSync(join(REFS, 'category-map.json'), 'utf8')).rows.find((r) => r.id === id)?.bucket ?? null;
} catch { /* no map: lint by type */ }
const lint = lintCopy((n) => files[n] ?? null, {
  full: true, name: c.name, bucket, readme: readme ?? undefined,
  connector: !bucket && (c.type === 'extractor' || c.type === 'writer'),
  retired: argv.includes('--retired'),
});

const live = Object.values(files).filter(Boolean).join('\n');
const verify = [...live.matchAll(/VERIFY\([^)]*\)[^\n]*/g)].map((m) => m[0].trim());

// README sections: heading text → body until the next heading of the same or higher level.
function sections(md) {
  const out = [];
  const lines = md.split(/\r?\n/);
  let cur = null;
  for (const l of lines) {
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { cur = { level: h[1].length, title: h[2].trim(), body: [] }; out.push(cur); continue; }
    if (cur) cur.body.push(l);
  }
  return out;
}
const clean = (s) => s.replace(/`|\*\*|\[|\]\([^)]*\)/g, '').replace(/\s*[:(].*$/, '').trim();

let readmeItems = [];
let prerequisites = null;
if (readme) {
  const secs = sections(readme);
  const long = files['component_long_description.md'].toLowerCase();
  for (const s of secs) {
    // "Object Properties values" or "Fetch Mode values" list form options, not data.
    if (/endpoint|object|report|supported|tables|entities|resources/i.test(s.title)
      && !/values|propert|option|configuration|parameter/i.test(s.title)) {
      for (const l of s.body) {
        const m = l.match(/^\s{0,4}[-*]\s+(.+)$/);
        if (!m) continue;
        const item = clean(m[1]);
        if (!item || item.length > 60) continue;
        const key = item.toLowerCase().replace(/s$/, '');
        if (!long.includes(key)) readmeItems.push(item);
      }
    }
    if (!prerequisites && /prerequisite|requirement|before you start|setup|authori[sz]ation/i.test(s.title)) {
      prerequisites = { heading: s.title, text: s.body.join('\n').trim().slice(0, 2000) };
    }
  }
  readmeItems = [...new Set(readmeItems)];
}

const result = {
  id,
  name: c.name,
  bucket,
  repo,
  readme: readme ? 'read' : repo ? 'not found' : 'no repo given',
  lint: lint.filter((f) => !/Schema\.json$/.test(f.file)),
  verify,
  readmeItems,
  prerequisites,
};
console.log(JSON.stringify(result, null, 2));
const errors = result.lint.filter((f) => f.level === 'error').length;
const todo = errors + verify.length + readmeItems.length;
console.error(`RESULT: ${id}: ${errors} rule error(s), ${verify.length} open VERIFY, ${readmeItems.length} README item(s) the long description does not name`);
process.exitCode = todo ? 1 : 0;
