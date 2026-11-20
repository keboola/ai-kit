#!/usr/bin/env node
// Draft category map (PRDCT-587). Pure: prints JSON to stdout and writes
// nothing unless --write. --md prints the one-page review artifact.
//
// The axis is COPY SHAPE, not marketing vertical. Rationale, measured:
// `type` is present on 396/396 visible components, `categories` on only 171 —
// 225 carry none. So the grouping is (direction x connection pattern), and the
// existing `categories` field is used as evidence where present, never as the
// spine. Repairing missing categories is PRDCT-588, not this.
//
// Classification is EVIDENCE, not a verdict — the bucket set is the owner's
// call (Matyáš). Same rule as section-rework: never apply before approval.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
// COMPONENT_COPY_REFS points at a checkout of the plugin repo, so a --write lands where it
// can be reviewed and released; the installed plugin is a cache copy.
const REFS = process.env.COMPONENT_COPY_REFS || join(SKILL_DIR, 'references');
const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const AS_MD = argv.includes('--md');

const inv = JSON.parse(readFileSync(join(REFS, 'inventory.json'), 'utf8'));

// --- signals ---------------------------------------------------------------
// Matched against hyphen/dot/underscore-separated segments of the id and name,
// never as substrings — 'box' must not fire on 'sandbox'.
const DB = new Set(['db', 'snowflake', 'bigquery', 'redshift', 'mysql', 'mariadb', 'postgres',
  'postgresql', 'oracle', 'mssql', 'sqlserver', 'mongodb', 'mongo', 'dynamodb', 'impala',
  'hive', 'teradata', 'sybase', 'db2', 'firebird', 'clickhouse', 'duckdb', 'motherduck',
  'exasol', 'informix', 'cassandra', 'elasticsearch', 'synapse', 'databricks', 'vertica',
  'trino', 'presto', 'athena', 'sqlite', 'hana', 'netezza', 'greenplum']);
// 'drive' and 'storage' were deliberately dropped from this set: they misfired
// on drive-cx.ex-drive-cx (a CX SaaS) and keboola.wr-azure-table-storage (a
// NoSQL store). Google Drive and Google Cloud Storage carry a `categories`
// value anyway, so nothing is lost.
const FILE = new Set(['s3', 'gcs', 'blob', 'sftp', 'ftp', 'dropbox', 'onedrive', 'sharepoint',
  'gdrive', 'box', 'zip', 'csv', 'excel', 'xlsx', 'parquet', 'files', 'file', 'azblob', 'wasb']);
const DIRECTION = { extractor: 'source', writer: 'destination' };
const STANDALONE = { application: 'application', processor: 'processor',
  transformation: 'transformation', 'code-pattern': 'code-pattern' };

const segments = (r) =>
  new Set(`${r.id} ${r.name}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

function classify(r) {
  const evidence = [];

  const standalone = STANDALONE[r.type];
  if (standalone) {
    // No sub-split and no template in the first cut — these are named in the
    // map so the fleet is fully covered, and left to hand-written copy.
    return { bucket: standalone, confidence: 'high', needsReview: false,
      evidence: [`type=${r.type}`], templated: false };
  }

  const dir = DIRECTION[r.type];
  if (!dir) return { bucket: 'unclassified', confidence: 'low', needsReview: true,
    evidence: [`unknown type '${r.type}'`], templated: false };

  const segs = segments(r);
  const catDb = r.cats.includes('Database');
  const catFile = r.cats.includes('File Storage');
  const tokDb = [...DB].filter((t) => segs.has(t));
  const tokFile = [...FILE].filter((t) => segs.has(t));

  let kind, confidence, needsReview = false;
  if (catDb) { kind = 'database'; confidence = 'high'; evidence.push('categories=Database'); }
  else if (catFile) { kind = 'file-storage'; confidence = 'high'; evidence.push('categories=File Storage'); }
  else if (tokDb.length && tokFile.length) {
    // Conflicting self-description — a human decides.
    kind = 'database'; confidence = 'low'; needsReview = true;
    evidence.push(`conflicting tokens: db(${tokDb.join('/')}) vs file(${tokFile.join('/')})`);
  } else if (tokDb.length) { kind = 'database'; confidence = 'high'; evidence.push(`id/name token '${tokDb[0]}'`); }
  else if (tokFile.length) { kind = 'file-storage'; confidence = 'high'; evidence.push(`id/name token '${tokFile[0]}'`); }
  else if (r.cats.length) {
    kind = 'saas-api'; confidence = 'medium';
    evidence.push(`SaaS by positive category evidence (${r.cats.join(', ')})`);
  } else {
    kind = 'saas-api'; confidence = 'low';
    evidence.push('no categories, no db/file token — SaaS by exclusion');
  }
  return { bucket: `${dir}/${kind}`, confidence, needsReview, evidence, templated: true };
}

// Explicit exceptions, each with a reason. An override is a human judgement,
// so it is never 'high' confidence — it lands in the review page's
// "needs your eye" list alongside the machine's own uncertain guesses.
const OVERRIDES = JSON.parse(readFileSync(join(REFS, 'overrides.json'), 'utf8')).overrides;

const rows = inv.rows.map((r) => {
  const c = classify(r);
  const o = OVERRIDES[r.id];
  if (o && c.templated) {
    c.evidence = [`override (${o.reason})`, `derived was ${c.bucket}: ${c.evidence[0]}`];
    c.bucket = o.bucket;
    c.confidence = 'medium';
    c.needsReview = true;
  }
  return { id: r.id, name: r.name, type: r.type, vendor: r.vendor, cats: r.cats,
    short: r.short, noCfgDesc: r.noCfgDesc, noLongDesc: r.noLongDesc, genericUI: r.genericUI, ...c };
});

const tally = (pred) => rows.filter(pred).length;
const buckets = [...new Set(rows.map((r) => r.bucket))].sort().map((b) => ({
  bucket: b,
  count: tally((r) => r.bucket === b),
  templated: rows.find((r) => r.bucket === b).templated,
  high: tally((r) => r.bucket === b && r.confidence === 'high'),
  medium: tally((r) => r.bucket === b && r.confidence === 'medium'),
  low: tally((r) => r.bucket === b && r.confidence === 'low'),
  needsReview: tally((r) => r.bucket === b && r.needsReview),
  gapFill: tally((r) => r.bucket === b && (r.noCfgDesc || r.noLongDesc)),
}));

// The owner's sign-off survives regeneration: a fresh --write must not silently
// reset a map Matyáš already approved.
let prior = {};
try { prior = JSON.parse(readFileSync(join(REFS, 'category-map.json'), 'utf8')); } catch { /* first run */ }
// ...but only for the map he approved: if any component changed bucket or the
// bucket set changed, the approval no longer describes this map.
const priorBucket = new Map((prior.rows || []).map((r) => [r.id, r.bucket]));
const priorSet = new Set((prior.buckets || []).map((b) => b.bucket));

const map = {
  generatedAt: new Date().toISOString(),
  inventoryFetchedAt: inv.fetchedAt,
  // The whole-map gate. While false, component-facts.mjs lets through only the
  // components listed under `confirmed` in overrides.json (the soft gate).
  reviewed: false,
  reviewedBy: null,
  reviewedAt: null,
  axis: 'direction x connection pattern (type is authoritative; categories used as evidence only)',
  buckets,
  rows,
};

const moved = rows.filter((r) => priorBucket.has(r.id) && priorBucket.get(r.id) !== r.bucket).map((r) => r.id);
// Components the owner never saw: the approval cannot cover them.
const unseen = rows.filter((r) => !priorBucket.has(r.id)).map((r) => r.id);
const sameSet = buckets.length === priorSet.size && buckets.every((b) => priorSet.has(b.bucket));
if (prior.reviewed === true && !moved.length && !unseen.length && sameSet) {
  map.reviewed = true;
  map.reviewedBy = prior.reviewedBy ?? null;
  map.reviewedAt = prior.reviewedAt ?? null;
}
const why = [
  moved.length && `${moved.length} moved: ${moved.slice(0, 5).join(', ')}`,
  unseen.length && `${unseen.length} new: ${unseen.slice(0, 5).join(', ')}`,
  !sameSet && 'bucket set changed',
].filter(Boolean).join('; ');
const approvalNote = prior.reviewed === true && !map.reviewed ? ` (owner approval dropped: ${why})` : '';

// Note: process.exitCode, never process.exit() — the latter truncates a large
// pending stdout write when output is piped.
if (WRITE) {
  writeFileSync(join(REFS, 'category-map.json'), JSON.stringify(map, null, 2) + '\n');
  console.log(
    `RESULT: category-map.json written — ${rows.length} components in ${buckets.length} buckets, reviewed=${map.reviewed}${approvalNote}`,
  );
} else if (!AS_MD) {
  console.log(JSON.stringify(map, null, 2));
} else {
  console.log(reviewPage());
}

// --- the one-page review artifact -----------------------------------------
function reviewPage() {
  const ex = (b, n = 3) => rows.filter((r) => r.bucket === b && r.short).slice(0, n);
  const out = [];
  out.push(`# Component copy — draft category map (for review)\n`);
  out.push(`Derived from \`GET /v2/storage\` at ${inv.fetchedAt} — ${rows.length} user-visible components. **Draft, not a decision:** the bucket set is yours to confirm or cut.\n`);
  out.push(`**Why not the \`categories\` field:** it is empty on ${inv.noCategory}/${rows.length} components, and where set the buckets are small and uneven (Database 36, File Storage 21, ERP 21, Marketing 18…). \`type\` is present on all ${rows.length}, so the spine is direction × connection pattern; \`categories\` is used as evidence where present.\n`);
  out.push(`## Buckets\n`);
  out.push(`| Bucket | Components | Template in first cut? | Assigned on hard evidence | Needs your eye | Has an empty copy field |`);
  out.push(`|---|---|---|---|---|---|`);
  for (const b of buckets) {
    out.push(`| \`${b.bucket}\` | ${b.count} | ${b.templated ? 'yes' : 'no — hand-written'} | ${b.high} | ${b.needsReview} | ${b.gapFill} |`);
  }
  out.push(`\n## What a template would touch — real examples per connector bucket\n`);
  for (const b of buckets.filter((x) => x.templated)) {
    out.push(`**\`${b.bucket}\`** (${b.count} components)`);
    for (const r of ex(b.bucket)) {
      out.push(`- \`${r.id}\` — current short description: _"${r.short}"_`);
    }
    out.push('');
  }
  const needsLook = rows.filter((r) => r.needsReview);
  const residual = rows.filter((r) => r.bucket.endsWith('/saas-api') && r.confidence === 'low');
  out.push(`## Assignments that need your eye (${needsLook.length} of ${rows.filter((r) => r.templated).length} connectors)\n`);
  out.push(`Everything else was assigned on an explicit signal — a \`categories\` value or a self-describing id — or fell into the residual API class. ${residual.length} components are in a \`saas-api\` bucket purely because they talk to neither a database nor a file store; that inference is listed per component in \`category-map.json\` rather than here.\n`);
  for (const r of needsLook.slice(0, 40)) {
    out.push(`- [ ] \`${r.id}\` → \`${r.bucket}\` — ${r.evidence[0]}`);
  }
  if (needsLook.length > 40) {
    out.push(`- … ${needsLook.length - 40} more of the same shape, listed in \`category-map.json\``);
  }
  out.push(`\n## Open questions (not mine to decide)\n`);
  out.push(`1. Is this the right bucket set, or do you want a finer cut (e.g. OAuth-SaaS vs token-SaaS)?`);
  out.push(`2. Do processors / applications / transformations (${rows.filter((r) => !r.templated).length} components) ever get templates, or stay hand-written?`);
  out.push(`3. Portal terminology: do descriptions adopt "data source connector" (as the help docs now say) or keep "extractor" (as \`extend/publish\` still says)?`);
  out.push(`4. Copy-only \`component_config\` PRs publish when the repo's workflow runs the portal update (a semver tag in the standard template): who cuts it, or do they ride the next regular release?`);
  out.push(`5. Components whose repo has no \`component_config/\` directory at all: portal edit by your team, or leave them?`);
  out.push(`6. ERP systems (Money S3, Oracle EBS, POHODA…) sit in \`saas-api\` with a per-kind note: their own bucket, or fine as they are?`);
  out.push(`7. Should the component's README be shown in the UI next to the form, or stay behind the Documentation link?`);
  return out.join('\n');
}
