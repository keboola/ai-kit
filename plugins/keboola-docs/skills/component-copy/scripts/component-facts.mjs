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
import { MONOREPOS, declaresExactly, parseGithubUrl, monorepoCandidates, decideLocation } from './lib/locate.mjs';

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

// lastGhError is the failure of the most recent call. Each lookup keeps its own,
// so a search 403 or an SSO refusal shows up in the reason it caused instead of
// reading as "not found" or "no access".
let lastGhError = null;
const gh = (args) => {
  try {
    lastGhError = null;
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    lastGhError = String(e.stderr || e.message || '').split('\n').find(Boolean)?.slice(0, 200) || 'gh failed';
    return null;
  }
};

// --- live copy -------------------------------------------------------------
// --index <storage.json> replaces the live fetch (tests, offline runs).
let index;
if (opt('--index')) index = JSON.parse(readFileSync(opt('--index'), 'utf8'));
else {
  const res = await fetch(STORAGE, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    console.error(`RESULT: ${STORAGE} answered ${res.status}`);
    process.exit(2);
  }
  index = await res.json();
}
const c = (index.components || []).find((x) => x.id === id);
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

// --- location: one repo and, in the monorepo, one folder ---------------------
// Evidence, strongest first: a workflow that declares the id in
// KBC_DEVELOPERPORTAL_APP, a file in keboola/components that declares it, the
// documentationUrl. Code search never returns archived repos (checked 2026-11-18:
// `repo:keboola/component-hubspot-v2 KBC_DEVELOPERPORTAL_APP` finds nothing), so a
// component whose old repo was archived is visible only through its
// documentationUrl and the monorepo. lib/locate.mjs makes the decision.
// `gh search code` returns nothing here even for queries the REST endpoint
// answers, so go through the endpoint directly. The text-match fragments say
// whether a hit declares exactly this id: the search matches a token phrase, so
// `x.ex-foo` also hits `x.ex-foo-v2`.
const searchCode = (q) => {
  const out = gh(['api', '-X', 'GET', 'search/code', '-f', `q=${q}`, '-f', 'per_page=100',
    '-H', 'Accept: application/vnd.github.text-match+json',
    '--jq', '{total: .total_count, incomplete: .incomplete_results, items: [.items[] | {repo: .repository.full_name, path, fragments: [.text_matches[]?.fragment]}]}']);
  if (out === null) return { error: lastGhError, items: [] };
  try { return JSON.parse(out); } catch { return { error: 'unreadable search result', items: [] }; }
};
// A hit without fragments (the media type was ignored) is read in full before it counts.
const hitDeclares = (h) => {
  if (h.fragments?.length) return h.fragments.some((f) => declaresExactly(f, id));
  const raw = gh(['api', `repos/${h.repo}/contents/${h.path}`, '-H', 'Accept: application/vnd.github.raw']);
  return raw !== null && declaresExactly(raw, id);
};
const repoMeta = (r) => {
  const out = gh(['api', `repos/${r}`, '--jq', '{b:.default_branch,p:.pushed_at,a:.archived}']);
  if (out === null) return { error: lastGhError };
  try { const m = JSON.parse(out); return { defaultBranch: m.b, pushedAt: m.p, archived: m.a === true }; } catch { return { error: 'unreadable repo metadata' }; }
};

const wf = searchCode(`org:keboola org:keboola-rnd "KBC_DEVELOPERPORTAL_APP" "${id}" path:.github/workflows`);
const metaOf = {};
const standalone = [...new Set(wf.items.filter((h) => !MONOREPOS.includes(h.repo) && hitDeclares(h)).map((h) => h.repo))]
  .map((r) => { metaOf[r] = repoMeta(r); return { repo: r, archived: metaOf[r].archived === true }; });

const docUrl = parseGithubUrl(copy.documentationUrl);
let docRepo = null;
if (!standalone.length && docUrl && !MONOREPOS.includes(docUrl.repo)) {
  metaOf[docUrl.repo] = repoMeta(docUrl.repo);
  // An unreadable documentation repo (404: deleted, private) is no evidence either way.
  if (!metaOf[docUrl.repo].error) docRepo = { repo: docUrl.repo, archived: metaOf[docUrl.repo].archived };
}

// Each monorepo: readable at all, its component folders (those with a
// component_config/), and the folders whose files declare or mention the id.
const probeMonorepo = (repo) => {
  const meta = gh(['api', `repos/${repo}`, '--jq', '{b:.default_branch,push:(.permissions.push // false)}']);
  if (meta === null) return { repo, readable: false, error: lastGhError };
  let branch = 'main', push = false;
  try { ({ b: branch, push } = JSON.parse(meta)); } catch { /* keep the defaults */ }
  const m = { repo, readable: true, defaultBranch: branch, push, roots: [], declared: [], mentioned: [], truncated: false, searchError: null };
  const tree = gh(['api', `repos/${repo}/git/trees/${branch}?recursive=1`, '--jq',
    '{truncated, roots: [.tree[] | select(.type == "tree" and (.path | test("(^|/)component_config$"))) | .path | sub("/?component_config$"; "")] }']);
  if (tree === null) { m.searchError = `tree listing failed: ${lastGhError}`; return m; }
  const t = JSON.parse(tree);
  // A component_config/ at the monorepo root is the kit's own, not a component.
  m.roots = t.roots.filter(Boolean);
  m.truncated = t.truncated === true;
  const s = searchCode(`repo:${repo} "${id}"`);
  if (s.error) m.searchError = s.error;
  else {
    if (s.incomplete) m.truncated = true;
    Object.assign(m, monorepoCandidates(s.items, m.roots, id));
  }
  return m;
};
const monos = MONOREPOS.map(probeMonorepo);

const decision = decideLocation({ id, standalone, docUrl, docRepo, monos, folder: opt('--folder') });
const location = decision.location;
const mono = location?.kind === 'monorepo' ? monos.find((m) => m.repo === location.repo) : null;
const repo = location?.repo ?? null;
const repoSource = location?.source ?? null;

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
    if (ci && /\/monorepo-/.test(ci[1])) {
      return { trigger: 'monorepo', via: `${file}: ${ci[1]} (a monorepo caller: the component is a folder, not this repo's root)`, ifLine: null };
    }
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

let publish = { componentConfigDir: null, propertiesJob: false, trigger: 'unknown', triggerVia: null, defaultBranch: null, latestTag: null, pushedAt: null, archived: false };
let metaError = null;
let configListError = null;
if (location?.kind === 'repo') {
  const meta = metaOf[repo] || repoMeta(repo);
  if (meta.error) metaError = meta.error;
  else Object.assign(publish, { defaultBranch: meta.defaultBranch, pushedAt: meta.pushedAt, archived: meta.archived });
}
// In the monorepo the folder's component_config/ is the copy, and the root
// workflows publish it: read the caller of component-ci's monorepo-publish.yml
// rather than assume it runs (its PUBLISH_ENABLED switch can turn releases off).
if (location?.kind === 'monorepo') {
  publish.defaultBranch = mono.defaultBranch;
  const files = gh(['api', `repos/${repo}/contents/${location.folder}/component_config`, '--jq', '[.[].name]']);
  if (files) { try { publish.componentConfigDir = JSON.parse(files); } catch {} }
  else configListError = lastGhError;
  const names = gh(['api', `repos/${repo}/contents/.github/workflows`, '--jq', '[.[].name]']);
  let caller = null;
  for (const n of (names ? JSON.parse(names) : []).filter((x) => /\.ya?ml$/.test(x))) {
    const wf = gh(['api', `repos/${repo}/contents/.github/workflows/${n}`, '--jq', '.content']);
    const text = wf ? Buffer.from(wf, 'base64').toString('utf8') : '';
    if (/keboola\/component-ci\/\.github\/workflows\/monorepo-publish\.ya?ml/.test(text)) { caller = { file: n, text }; break; }
  }
  if (caller) {
    publish.propertiesJob = true;
    const sw = caller.text.match(/PUBLISH_ENABLED\s*:\s*([^\n#]+)/);
    const value = sw ? sw[1].trim() : null;
    publish.trigger = value && /^(false|'false'|"false"|0)$/i.test(value) ? 'unknown' : 'monorepo';
    publish.triggerVia = `${caller.file}: calls component-ci monorepo-publish.yml (releases raised versions on push to ${mono.defaultBranch})` +
      (value ? `; PUBLISH_ENABLED: ${value}` : '; no PUBLISH_ENABLED line found');
  } else {
    publish.triggerVia = `no caller of component-ci monorepo-publish.yml found in ${repo}/.github/workflows`;
  }
}
if (location?.kind === 'repo' && !publish.archived) {
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
for (const reason of decision.hard) block('hard', reason);
for (const reason of decision.notes) gate.reasons.push(reason);
if (wf.error && !location) {
  gate.reasons.push(`The workflow search failed (gh said: ${wf.error}); re-run in a minute before trusting "could not resolve".`);
}
if (location?.kind === 'repo' && metaError) {
  // Without the metadata the archived flag is unknown, and an archived repo refuses the PR.
  block('hard', `Could not read ${repo}'s metadata (gh said: ${metaError}), so whether it is archived is unknown. Re-run before anything else.`);
}
if (location?.kind === 'repo' && publish.archived) {
  // Code search skips archived repos and decideLocation treats an archived
  // documentation repo as a predecessor, so this is a repo archived between the
  // two lookups of this run.
  block('hard', `${repo} is archived: no PR can go there. Ask the Component Factory owner where ${id} lives now.`);
}
if (location?.kind === 'repo' && !publish.archived && !metaError && publish.componentConfigDir === null) {
  block('hard', `${repo} has no component_config/ directory: this component's copy is portal-only. File the proposal and stop; the portal write needs vendor credentials.`);
}
if (location?.kind === 'monorepo' && publish.componentConfigDir === null) {
  block('hard', `Could not list ${repo}/${location.folder}/component_config${configListError ? ` (gh said: ${configListError})` : ''}. Re-run before anything else.`);
}
if (location?.kind === 'monorepo' && !mono.push) {
  gate.reasons.push(`This gh account cannot push to ${repo}: open the PR from a fork, if the organization allows forking it, or ask the owner for push access to branches.`);
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
if (location?.kind === 'monorepo') {
  gate.reasons.push(`Publish trigger is "${publish.trigger}" (${publish.triggerVia}). Whether a copy-only change needs a raised version to go live is unverified: use the monorepo caveat and ask the reviewer.`);
}
if (location?.kind === 'repo' && publish.propertiesJob && publish.trigger !== 'tag') {
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
  // Where the PR goes: `repo`, and inside it `folder` ('' = the repo root).
  repo,
  folder: location?.folder ?? null,
  repoSource,
  predecessor: decision.predecessor,
  monorepos: monos.map((m) => ({
    repo: m.repo,
    readable: m.readable,
    error: m.error ?? null,
    push: m.push ?? null,
    declared: m.declared ?? [],
    mentioned: m.mentioned ?? [],
    searchError: m.searchError ?? null,
    truncated: m.truncated ?? false,
    components: m.roots?.length ?? 0,
  })),
  publish,
  gate,
  fetchedAt: new Date().toISOString(),
};

console.log(JSON.stringify(facts, null, 2));
if (gate.blocked) process.exitCode = 1;
