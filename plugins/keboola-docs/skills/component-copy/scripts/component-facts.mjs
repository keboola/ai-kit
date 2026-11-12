#!/usr/bin/env node
// Facts about one component, gathered before any model reads anything. Cheap,
// exact, and it stops the rewrite from being assembled out of recollection.
//
// Prints one JSON blob: live copy, bucket, the publish path, and a verdict.
// Exit 0 = cleared for the full procedure, 1 = gated (read `gate.level`:
// soft = draft a proposal only, hard = stop), 2 = broken input.
//
// Uses the already-authenticated `gh` CLI rather than a token of its own, so
// the script carries no credentials.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isVisible } from './lib/visible.mjs';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
// COMPONENT_COPY_REFS points at a checkout of the plugin repo, so a --write lands where it
// can be reviewed and released; the installed plugin is a cache copy.
const REFS = process.env.COMPONENT_COPY_REFS || join(SKILL_DIR, 'references');
const STORAGE = 'https://connection.keboola.com/v2/storage';

const argv = process.argv.slice(2);
// A flag's value is the next argument, unless that is another flag.
const opt = (name) => {
  const i = argv.indexOf(name);
  const v = i > -1 ? argv[i + 1] : undefined;
  return v && !v.startsWith('--') ? v : null;
};

// --local <component_config dir> --bucket <bucket>: a component that is not
// published yet (the engineering-toolkit case). Nothing to look up: no live
// copy, no repo search, no gate; just which template applies and what is empty.
if (argv.includes('--local')) {
  const dir = opt('--local');
  const bucket = opt('--bucket');
  if (!dir || !bucket) {
    console.error('usage: component-facts.mjs --local <component_config dir> --bucket <source/...|destination/...|application>');
    process.exit(2);
  }
  const { existsSync } = await import('node:fs');
  const text = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8').trim() : '');
  const copy = {
    shortDescription: text('component_short_description.md'),
    longDescription: text('component_long_description.md'),
    configurationDescription: text('configuration_description.md'),
    documentationUrl: text('documentationUrl.md'),
  };
  const template = bucket.startsWith('source/') ? 'references/templates/source.md'
    : bucket.startsWith('destination/') ? 'references/templates/destination.md'
    : bucket === 'application' ? 'references/templates/application.md (stub: confirm with the owner)' : null;
  console.log(JSON.stringify({
    mode: 'local', dir, bucket, template, copy,
    gaps: Object.keys(copy).filter((k) => !copy[k]),
    next: `lint-copy.mjs ${dir} --full --schemas`,
  }, null, 2));
  if (!template) console.error(`RESULT: unknown bucket "${bucket}": use source/<kind>, destination/<kind> or application`);
  process.exit(template ? 0 : 2);
}

const id = argv[0];
if (!id || id.startsWith('--')) {
  console.error('usage: component-facts.mjs <component.id> | --local <component_config dir> --bucket <bucket>');
  process.exit(2);
}

// The first gh failure is kept, so an unauthenticated CLI or a search 403 shows
// up in the gate reason instead of as a silent "could not resolve".
let ghError = null;
const gh = (args) => {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    if (!ghError) ghError = String(e.stderr || e.message || '').split('\n').find(Boolean)?.slice(0, 200) || null;
    return null;
  }
};

// --- live copy -------------------------------------------------------------
const res = await fetch(STORAGE, { headers: { accept: 'application/json' } });
if (!res.ok) {
  console.error(`RESULT: ${STORAGE} answered ${res.status}`);
  process.exit(2);
}
const c = ((await res.json()).components || []).find((x) => x.id === id);
if (!c) {
  console.error(`RESULT: ${id} is not in the Storage component index`);
  process.exit(2);
}
// Public components only (owner's rule, 2026-07-28): expired, hidden or
// deprecated ones are out, whatever the category map says.
// --include-hidden: component-retire works on components that are already deprecated or
// hidden; every other caller keeps the public-only rule.
const hidden = !isVisible(c);
if (hidden && !argv.includes('--include-hidden')) {
  console.error(`RESULT: ${id} is not public (expired, excludeFromNewList or deprecated): out of scope`);
  process.exit(2);
}

const s = (v) => (typeof v === 'string' ? v.trim() : '');
const copy = {
  shortDescription: s(c.description),
  longDescription: s(c.longDescription),
  configurationDescription: s(c.configurationDescription),
  documentationUrl: s(c.documentationUrl),
  hasSchema: !!c.configurationSchema && Object.keys(c.configurationSchema).length > 0,
  hasRowSchema: !!c.configurationRowSchema && Object.keys(c.configurationRowSchema).length > 0,
};
const gaps = ['longDescription', 'configurationDescription'].filter((k) => !copy[k]);

// --- bucket + the map gate -------------------------------------------------
const map = JSON.parse(readFileSync(join(REFS, 'category-map.json'), 'utf8'));
const row = map.rows.find((r) => r.id === id);

// --- repo resolution -------------------------------------------------------
// The workflow declares the component id in KBC_DEVELOPERPORTAL_APP, which makes
// code search authoritative. documentationUrl is only a fallback: it points at
// whatever the vendor chose, which is often not the component's own repo.
let repo = null, repoSource = null;
// `gh search code` returns nothing here even for queries the REST endpoint
// answers, so go through the endpoint directly.
const hit = gh(['api', '-X', 'GET', 'search/code',
  '-f', `q=org:keboola org:keboola-rnd "KBC_DEVELOPERPORTAL_APP" "${id}" path:.github/workflows`,
  '--jq', '[.items[].repository.full_name]']);
let ambiguous = null;
if (hit) {
  try {
    const repos = [...new Set(JSON.parse(hit))];
    if (repos.length === 1) { repo = repos[0]; repoSource = 'workflow KBC_DEVELOPERPORTAL_APP'; }
    // Several repos declare it (a fork, a test pipeline): do not pick one.
    else if (repos.length > 1) ambiguous = repos;
  } catch { /* fall through to the URL guess */ }
}
if (!repo && !ambiguous && /github\.com\/([^/]+)\/([^/#?]+)/.test(copy.documentationUrl)) {
  const [, owner, name] = copy.documentationUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  repo = `${owner}/${name.replace(/\.git$/, '')}`;
  repoSource = 'documentationUrl (unverified — may be a docs repo, not the component repo)';
}

// --- publish path ----------------------------------------------------------
// When does a merged component_config change reach the Developer Portal? Read it
// off the workflow instead of assuming: the portal then syncs to the stacks
// within minutes, so "merge" and "live" can be ~5 minutes apart in a repo that
// publishes on push, and a release apart in one that publishes on a tag.
// The lines of one YAML job, read by indentation: the block runs until the next
// line at the job's own indent or shallower. Blank lines and comments never end
// it. `keys` holds the job's direct scalar keys (`if`, `needs`, ...).
function jobBlock(text, name) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^( +)${name}:\\s*(#.*)?$`).test(l));
  if (start < 0) return null;
  const indent = lines[start].length - lines[start].trimStart().length;
  const body = [];
  for (const l of lines.slice(start + 1)) {
    const t = l.trim();
    if (!t || t.startsWith('#')) { body.push(l); continue; }
    if (l.length - l.trimStart().length <= indent) break;
    body.push(l);
  }
  const childIndent = Math.min(...body.filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => l.length - l.trimStart().length));
  const keys = {};
  for (const l of body) {
    if (l.length - l.trimStart().length !== childIndent) continue;
    const kv = l.trim().match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv && !(kv[1] in keys)) keys[kv[1]] = kv[2].trim() || null;
  }
  return { body: body.join('\n'), keys };
}

function detectTrigger(texts) {
  for (const { file, text } of texts) {
    const ci = text.match(/uses:\s*(keboola\/component-ci\/\S+)/);
    if (ci) {
      return { trigger: 'tag', via: `${file}: ${ci[1]} (by the reusable workflow's convention: default branch, tag ref, bare semver; check that ref)`, ifLine: null };
    }
    const m = jobBlock(text, 'update_developer_portal_properties');
    if (!m) {
      // The script may sit in a job under another name; reading the whole file
      // would pick up some other job's guard, so say so instead of guessing.
      if (text.includes('update_properties.sh')) {
        return { trigger: 'unknown', via: `${file}: update_properties.sh is called, but not from a job named update_developer_portal_properties; read the workflow by hand`, ifLine: null };
      }
      continue;
    }
    // Only the job's own `if:` (at its key indent) guards the job; a step's
    // `if:` deeper down guards that step alone.
    const ifLine = m.keys.if ?? null;
    if (!ifLine) return { trigger: 'every-push', via: `${file}: properties job has no if: guard`, ifLine };
    if (/!\s*\(?\s*(startsWith|contains)?\s*\(?\s*github\.ref|!=/.test(ifLine)) {
      return { trigger: 'unknown', via: `${file}: negated guard, read it by hand: if: ${ifLine}`, ifLine };
    }
    if (/refs\/tags/.test(ifLine)) return { trigger: 'tag', via: `${file}: if: ${ifLine}`, ifLine };
    if (/refs\/heads\//.test(ifLine)) return { trigger: 'push-default', via: `${file}: if: ${ifLine}`, ifLine };
    if (/is_deploy_ready/.test(ifLine) && /refs\/tags/.test(text)) {
      return { trigger: 'tag', via: `${file}: if: ${ifLine}, and is_deploy_ready requires a tag ref`, ifLine };
    }
    return { trigger: 'unknown', via: `${file}: if: ${ifLine}`, ifLine };
  }
  return { trigger: 'unknown', via: 'no Developer Portal properties step found in .github/workflows', ifLine: null };
}

let publish = { componentConfigDir: null, propertiesJob: false, trigger: 'unknown', triggerVia: null, defaultBranch: null, latestTag: null, pushedAt: null };
if (repo) {
  const meta = gh(['api', `repos/${repo}`, '--jq', '{b:.default_branch,p:.pushed_at}']);
  if (meta) {
    try { const m = JSON.parse(meta); publish.defaultBranch = m.b; publish.pushedAt = m.p; } catch {}
  }
  const files = gh(['api', `repos/${repo}/contents/component_config`, '--jq', '[.[].name]']);
  if (files) { try { publish.componentConfigDir = JSON.parse(files); } catch {} }
  const names = gh(['api', `repos/${repo}/contents/.github/workflows`, '--jq', '[.[].name]']);
  const texts = [];
  if (names) {
    let list = [];
    try { list = JSON.parse(names).filter((n) => /\.ya?ml$/.test(n)); } catch {}
    // push.yml first: it is where the standard template puts the job.
    list.sort((x, y) => (y === 'push.yml') - (x === 'push.yml'));
    // Stop at the first file that carries the portal step: one API call in the
    // usual case instead of one per workflow file.
    const hasStep = (text) => text.includes('update_developer_portal_properties') ||
      text.includes('update_properties.sh') || /uses:\s*keboola\/component-ci\//.test(text);
    for (const n of list) {
      const wf = gh(['api', `repos/${repo}/contents/.github/workflows/${n}`, '--jq', '.content']);
      if (!wf) continue;
      const text = Buffer.from(wf, 'base64').toString('utf8');
      texts.push({ file: n, text });
      if (hasStep(text)) break;
    }
  }
  publish.propertiesJob = texts.some(({ text }) => text.includes('update_developer_portal_properties') ||
    text.includes('update_properties.sh') || /uses:\s*keboola\/component-ci\//.test(text));
  const t = detectTrigger(texts);
  publish.trigger = t.trigger;
  publish.triggerVia = t.via;
  publish.latestTag = gh(['api', `repos/${repo}/tags`, '--jq', '.[0].name']) || null;
}

// --- verdict ---------------------------------------------------------------
// Two levels. HARD: there is nothing a component_config PR can fix (no repo,
// portal-only copy, custom UI); stop, no draft. SOFT: the owner has not signed
// off yet; drafting a proposal is fine, opening a PR is not. A soft gate lifts
// for the whole map (category-map.json reviewed=true) or for one component
// (listed under `confirmed` in references/overrides.json).
const overrides = JSON.parse(readFileSync(join(REFS, 'overrides.json'), 'utf8'));
const confirmed = (overrides.confirmed || {})[id] || null;
const gate = { blocked: false, level: null, reasons: [], confirmed };
const block = (level, reason) => {
  gate.blocked = true;
  if (gate.level !== 'hard') gate.level = level;
  gate.reasons.push(`[${level}] ${reason}`);
};
// The map holds public components only, so a hidden or deprecated one (component-retire,
// --include-hidden) is never in it: that is expected, not a reason to stop. Its UI kind comes from
// the live flags instead of the map row.
if (!row && !hidden) {
  block('hard', 'Not present in category-map.json: regenerate the map (scripts/classify.mjs --write) before touching this component.');
}
if (!row && hidden) {
  gate.reasons.push('Not in category-map.json because it is not public; lint it with lint-copy.mjs --retired (no bucket rules apply).');
}
const genericUI = row ? row.genericUI : (c.flags || []).includes('genericDockerUI');
if (genericUI === false && ['extractor', 'writer', 'application'].includes(c.type)) {
  block('hard', 'Not a generic-UI component: its fields may be hard-coded in the Keboola UI monorepo, which needs a monorepo PR, not a config change.');
}
if (ambiguous) {
  block('hard', `${ambiguous.length} repositories declare ${id} in a workflow (${ambiguous.join(', ')}): pick the component's own repo by hand before anything else.`);
} else if (!repo) {
  block('hard', `Could not resolve the component repository: nothing to open a PR against.${ghError ? ` gh said: ${ghError}` : ''}`);
}
if (repo && publish.componentConfigDir === null) {
  block('hard', `${repo} has no component_config/ directory: this component's copy is portal-only. File the proposal and stop; the portal write needs vendor credentials.`);
}
if (!map.reviewed && !confirmed) {
  block('soft', 'Neither the category map (reviewed=false, PRDCT-587) nor this component (not under `confirmed` in overrides.json) is owner-approved. Draft a proposal for the owner; do not open a PR.');
}
if (confirmed && row && confirmed.bucket !== row.bucket) {
  block('soft', `The owner confirmed ${confirmed.bucket}, but the map now says ${row.bucket}; re-confirm before a PR.`);
}
if (!map.reviewed && confirmed && row && confirmed.bucket === row.bucket) {
  gate.reasons.push(`Owner-confirmed for this component: bucket ${confirmed.bucket}, by ${confirmed.by} on ${confirmed.on}.`);
}
if (repo && publish.componentConfigDir && !publish.propertiesJob) {
  gate.reasons.push(`${repo} has component_config/ but no update_developer_portal_properties job was found: the publish path is unverified. Say so in the PR body.`);
}
if (repo && publish.propertiesJob && publish.trigger !== 'tag') {
  gate.reasons.push(`Publish trigger is "${publish.trigger}" (${publish.triggerVia}). Use the matching caveat in the PR body; on every-push or push-default the merge goes live within minutes.`);
}
if (!gaps.length) {
  gate.reasons.push('No empty copy field: this would be a restyle of existing prose, which is phase 2 — not the gap-fill first cut.');
}

const facts = {
  id,
  name: c.name,
  type: c.type,
  public: !hidden,
  flags: c.flags || [],
  categories: c.categories || [],
  bucket: row?.bucket ?? null,
  bucketConfidence: row?.confidence ?? null,
  bucketEvidence: row?.evidence ?? null,
  template: row?.templated
    ? `references/templates/${row.bucket.startsWith('source') ? 'source' : 'destination'}.md`
    : row?.bucket === 'application' ? 'references/templates/application.md (stub: confirm with the owner)' : null,
  copy,
  gaps,
  repo,
  repoSource,
  ambiguousRepos: ambiguous,
  publish,
  gate,
  fetchedAt: new Date().toISOString(),
};

console.log(JSON.stringify(facts, null, 2));
if (gate.blocked) process.exitCode = 1;
