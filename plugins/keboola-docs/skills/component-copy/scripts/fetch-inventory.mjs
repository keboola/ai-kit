#!/usr/bin/env node
// Component inventory: the user-visible component set, derived from the public
// Storage index. Dependency-free on purpose — this skill is meant to move into
// the engineering toolkit as a plain copy, not a port.
//
// Default is --check: fetch, diff against the stored snapshot, print the drift,
// write nothing, exit 1 if anything moved. --write refreshes the snapshot.
//
// Row shape is storage-derived ONLY. Link-status fields from the 2026-08-17
// audit (status / target / inHelp) are NOT re-derived here — they cost a
// several-hundred-URL curl sweep and belong to PRDCT-648/650. They stay in
// references/inventory-2026-08-17.json and references/repo_status.txt as
// dated evidence.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isVisible } from './lib/visible.mjs';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
// COMPONENT_COPY_REFS points at a checkout of the plugin repo, so a --write lands where it
// can be reviewed and released; the installed plugin is a cache copy.
const REFS = process.env.COMPONENT_COPY_REFS || join(SKILL_DIR, 'references');
const SNAPSHOT = join(REFS, 'inventory.json');
const RAW = join(REFS, 'storage-index.json');
const SOURCE = 'https://connection.keboola.com/v2/storage';

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const KEEP_RAW = argv.includes('--raw');
const AS_JSON = argv.includes('--json');

// The public set: see lib/visible.mjs for what it does and does not prove.

const len = (v) => (typeof v === 'string' ? v.trim().length : 0);

function row(c) {
  const docUrl = c.documentationUrl || '';
  let host = '';
  try { host = docUrl ? new URL(docUrl).host : ''; } catch { host = 'INVALID_URL'; }
  return {
    id: c.id,
    name: c.name || '',
    type: c.type || '',
    cats: c.categories || [],
    vendor: String(c.id).split('.')[0],
    url: docUrl,
    host,
    // The copy surface. The short description is carried verbatim because the
    // review one-pager and the skill both quote it; the long/config bodies are
    // only measured (they are large, and the skill re-fetches them live).
    short: (c.description || '').trim(),
    shortLen: len(c.description),
    longLen: len(c.longDescription),
    cfgDescLen: len(c.configurationDescription),
    noLongDesc: len(c.longDescription) === 0,
    noCfgDesc: len(c.configurationDescription) === 0,
    hasSchema: !!c.configurationSchema && Object.keys(c.configurationSchema).length > 0,
    hasRowSchema: !!c.configurationRowSchema && Object.keys(c.configurationRowSchema).length > 0,
    // Custom-UI components are out of scope: their fields are hard-coded in the
    // Keboola UI monorepo, so they need a monorepo PR, not a config change.
    genericUI: (c.flags || []).includes('genericDockerUI'),
  };
}

// Compare only the fields this script actually derives, so a baseline written
// by an older version (or the rescued audit rows) doesn't produce phantom drift.
const COMPARED = ['name', 'type', 'cats', 'url', 'noLongDesc', 'noCfgDesc'];

function readBaseline() {
  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
    return Array.isArray(parsed) ? { fetchedAt: 'unknown', rows: parsed } : parsed;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

function diff(oldRows, newRows) {
  const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
  const a = byId(oldRows), b = byId(newRows);
  const added = [...b.keys()].filter((id) => !a.has(id));
  const removed = [...a.keys()].filter((id) => !b.has(id));
  const changed = [];
  for (const [id, nb] of b) {
    const na = a.get(id);
    if (!na) continue;
    const fields = COMPARED.filter(
      (f) => JSON.stringify(na[f]) !== JSON.stringify(nb[f]) && na[f] !== undefined,
    );
    if (fields.length) changed.push({ id, fields });
  }
  return { added, removed, changed };
}

function summarize(rows) {
  const by = (fn) => rows.reduce((m, r) => (m[fn(r)] = (m[fn(r)] || 0) + 1, m), {});
  return {
    visible: rows.length,
    byType: by((r) => r.type),
    byVendor: Object.fromEntries(
      Object.entries(by((r) => r.vendor)).sort((x, y) => y[1] - x[1]).slice(0, 6),
    ),
    noCategory: rows.filter((r) => r.cats.length === 0).length,
    noCfgDesc: rows.filter((r) => r.noCfgDesc).length,
    noLongDesc: rows.filter((r) => r.noLongDesc).length,
  };
}

const res = await fetch(SOURCE, { headers: { accept: 'application/json' } });
if (!res.ok) {
  console.error(`RESULT: fetch failed — ${SOURCE} answered ${res.status}`);
  process.exit(2);
}
const index = await res.json();
const all = index.components || [];
const rows = all.filter(isVisible).map(row).sort((x, y) => x.id.localeCompare(y.id));
const snapshot = {
  fetchedAt: new Date().toISOString(),
  source: SOURCE,
  totalComponents: all.length,
  ...summarize(rows),
  rows,
};

// Note: process.exitCode, never process.exit() — the latter truncates a large
// pending stdout write when output is piped.
if (AS_JSON) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  const baseline = readBaseline();

  if (WRITE) {
    writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n');
    if (KEEP_RAW) writeFileSync(RAW, JSON.stringify(index) + '\n');
    const d = baseline ? diff(baseline.rows, rows) : null;
    const drift = d
      ? `+${d.added.length}/-${d.removed.length}/~${d.changed.length}`
      : 'first snapshot';
    console.log(`RESULT: inventory written — ${rows.length} visible of ${all.length} (${drift})`);
  } else {
    // --check (default)
    console.log(`${SOURCE}: ${all.length} components, ${rows.length} visible`);
    console.log(
      `no category ${snapshot.noCategory} · no configurationDescription ${snapshot.noCfgDesc} · no longDescription ${snapshot.noLongDesc}`,
    );
    console.log(`types: ${JSON.stringify(snapshot.byType)}`);

    if (!baseline) {
      console.log('RESULT: no snapshot yet — run with --write to seed references/inventory.json');
      process.exitCode = 1;
    } else {
      const d = diff(baseline.rows, rows);
      const total = d.added.length + d.removed.length + d.changed.length;
      if (total === 0) {
        console.log(`RESULT: no drift against snapshot ${baseline.fetchedAt} (${rows.length} components)`);
      } else {
        if (d.added.length) console.log(`\nADDED (${d.added.length}): ${d.added.join(', ')}`);
        if (d.removed.length) console.log(`\nREMOVED (${d.removed.length}): ${d.removed.join(', ')}`);
        if (d.changed.length) {
          console.log(`\nCHANGED (${d.changed.length}):`);
          for (const c of d.changed.slice(0, 40)) console.log(`  ${c.id}: ${c.fields.join(', ')}`);
          if (d.changed.length > 40) console.log(`  … ${d.changed.length - 40} more`);
        }
        console.log(`\nRESULT: drift +${d.added.length}/-${d.removed.length}/~${d.changed.length} against ${baseline.fetchedAt} — rerun with --write to accept`);
        process.exitCode = 1;
      }
    }
  }
}
