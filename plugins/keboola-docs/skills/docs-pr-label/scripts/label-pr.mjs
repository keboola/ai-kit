#!/usr/bin/env node
// Gives a keboola/connection-docs pull request the labels its work belongs under, from rules.json:
//   - a section label (getting-started, apps-ga, …) when the PR's title or branch names the
//     section's ticket, or, with no ticket match, when the section's paths hold at least
//     `sectionShare` of the changed files (the most-covered section wins);
//   - a "touches" label (site-tooling) when any changed file is under its paths.
// It only adds labels that already exist in the repo, never creates or removes one, and leaves
// PRs by other authors alone. Dry run unless --apply.
//
//   node label-pr.mjs 1187 1185            # what would be added
//   node label-pr.mjs --apply https://github.com/keboola/connection-docs/pull/1187
//   node label-pr.mjs --all-mine [--apply]  # every open PR by an author in rules.json
//   node label-pr.mjs --preview --title "PRDCT-487: x" --branch my-branch --files a.md,b.mjs
//                                            # before the PR exists (docs-ship), no gh calls
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'rules.json'), 'utf8'));
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const allMine = args.includes('--all-mine');
const repo = (args.find((a) => a.startsWith('--repo=')) || `--repo=${RULES.repo}`).slice(7);
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const under = (file, paths) => paths.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));

// The rules, from a title, a branch and the changed files: which labels, and why.
function decide(title, branch, files) {
  const text = `${title} ${branch}`.toUpperCase();
  const want = new Set();
  const why = [];
  const byTicket = RULES.sections.filter((s) => (s.tickets || []).some((t) => text.includes(t.toUpperCase())));
  if (byTicket.length) {
    for (const s of byTicket) { want.add(s.label); why.push(`${s.label}: ticket`); }
  } else if (files.length) {
    const scored = RULES.sections
      .map((s) => ({ s, k: files.filter((f) => under(f, s.paths)).length }))
      .filter((x) => x.k / files.length >= RULES.sectionShare)
      .sort((a, b) => b.k - a.k);
    if (scored.length) { want.add(scored[0].s.label); why.push(`${scored[0].s.label}: ${scored[0].k}/${files.length} files`); }
  }
  for (const t of RULES.touches) {
    const hit = files.filter((f) => under(f, t.paths));
    if (hit.length) { want.add(t.label); why.push(`${t.label}: ${hit.slice(0, 3).join(', ')}${hit.length > 3 ? ', …' : ''}`); }
  }
  return { want: [...want], why };
}

if (args.includes('--preview')) {
  const val = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] ?? '') : ''; };
  const files = val('--files').split(',').map((f) => f.trim()).filter(Boolean);
  const { want, why } = decide(val('--title'), val('--branch'), files);
  console.log(want.length ? `would label: ${want.join(', ')} (${why.join('; ')})` : 'would label: nothing (no rule matched)');
  console.log('labels missing from the repo are skipped at --apply time, never created');
  process.exit(0);
}

// rules.json `authors`: an explicit list of GitHub logins, or [] for "whoever is logged into gh".
const AUTHORS = RULES.authors?.length ? RULES.authors : [gh('api', 'user', '-q', '.login').trim()];

let refs = args.filter((a) => !a.startsWith('--')).map((a) => (a.match(/\/pull\/(\d+)/) || [null, a])[1]);
if (allMine) {
  for (const author of AUTHORS) {
    const list = JSON.parse(gh('pr', 'list', '--repo', repo, '--author', author, '--state', 'open', '--limit', '200', '--json', 'number'));
    refs.push(...list.map((p) => String(p.number)));
  }
}
refs = [...new Set(refs)].filter((r) => /^\d+$/.test(r));
if (!refs.length) {
  console.error('usage: label-pr.mjs [--apply] [--repo=owner/name] (<pr number or url>… | --all-mine) | --preview --title <t> --branch <b> --files <a,b>');
  process.exit(2);
}

const existing = new Set(JSON.parse(gh('label', 'list', '--repo', repo, '--limit', '500', '--json', 'name')).map((l) => l.name));
let failed = 0;
for (const n of refs) {
  const pr = JSON.parse(gh('pr', 'view', n, '--repo', repo, '--json', 'number,title,headRefName,author,labels,url'));
  if (!AUTHORS.includes(pr.author.login)) {
    console.log(`#${n}  skip: by ${pr.author.login}, not an author in rules.json`);
    continue;
  }
  const files = gh('api', `repos/${repo}/pulls/${n}/files`, '--paginate', '-q', '.[].filename').split('\n').filter(Boolean);
  const { want, why } = decide(pr.title, pr.headRefName, files);

  const have = new Set(pr.labels.map((l) => l.name));
  const add = [...want].filter((l) => !have.has(l) && existing.has(l));
  const missing = [...want].filter((l) => !existing.has(l));
  const note = `${why.join('; ') || 'no rule matched'}${missing.length ? `; not in the repo, not created: ${missing.join(', ')}` : ''}`;
  if (!add.length) {
    console.log(`#${n}  nothing to add (${note})`);
    continue;
  }
  if (apply) {
    try {
      gh('pr', 'edit', n, '--repo', repo, '--add-label', add.join(','));
      console.log(`#${n}  added ${add.join(', ')} (${note})`);
    } catch (e) {
      failed++;
      console.log(`#${n}  FAILED to add ${add.join(', ')}: ${String(e.stderr || e.message).trim()}`);
    }
  } else {
    console.log(`#${n}  would add ${add.join(', ')} (${note})`);
  }
}
process.exit(failed ? 1 : 0);
