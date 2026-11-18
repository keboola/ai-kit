// Where a component's copy lives: one repository and, in a monorepo, one folder.
//
// In November 2026 the Component Factory moved most components into monorepos and
// archived the old keboola/component-* repos (see the keboola/component-ci README,
// "Monorepo workflows"). There are two: keboola/components and
// keboola/components-private (both named in Matyáš Jirát's GitHub App request in
// #ask-access, 2026-11-04). A component can now be in its own repo (repo root), in
// a monorepo folder, or in both while a move is half done. component-facts.mjs
// gathers the evidence through gh; the functions here only decide, so they can be
// tested without the network.
export const MONOREPOS = ['keboola/components', 'keboola/components-private'];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Code search tokenizes on punctuation, so a quoted id also matches inside a longer
// id (`x.ex-foo` inside `x.ex-foo-v2`). These checks run on the matched text.
// The id must not be glued to another id character on either side; a trailing
// dot only counts as punctuation when no word follows it.
export function mentionsExactly(text, id) {
  const re = new RegExp(`(^|[^A-Za-z0-9_.-])${escape(id)}(?![A-Za-z0-9_-]|\\.[A-Za-z0-9])`);
  return re.test(text || '');
}

// A declaration assigns the id to a key (KBC_DEVELOPERPORTAL_APP: "x.ex-foo",
// id = 'x.ex-foo', "componentId": "x.ex-foo"); prose that merely names it ("replaces
// x.ex-foo") does not count.
export function declaresExactly(text, id) {
  const re = new RegExp(`[A-Za-z0-9_]\\s*["']?\\s*[:=]\\s*["']?${escape(id)}(?![A-Za-z0-9_-]|\\.[A-Za-z0-9])`);
  return re.test(text || '');
}

// The component folder a path belongs to: the deepest root (a folder that holds a
// component_config/) that the path is in. Paths outside every root belong to no
// component (the monorepo's own files) and give null.
export function nearestRoot(path, roots) {
  let best = null;
  for (const r of roots) {
    if ((path === r || path.startsWith(`${r}/`)) && (!best || r.length > best.length)) best = r;
  }
  return best;
}

// owner/name and, for /tree/<ref>/<path> or /blob/<ref>/<path>, the folder the URL
// points at (a file's own folder for /blob/).
export function parseGithubUrl(url) {
  const m = /github\.com\/([^/\s]+)\/([^/#?\s]+)(?:\/(tree|blob)\/[^/]+\/([^#?\s]*))?/.exec(url || '');
  if (!m) return null;
  const repo = `${m[1]}/${m[2].replace(/\.git$/, '')}`;
  let path = (m[4] || '').replace(/\/+$/, '');
  if (m[3] === 'blob') path = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return { repo, path };
}

// Which folders of one monorepo hold the component, from search hits
// ({ path, fragments }) and the component roots of its tree. Declaring hits win;
// mentions only count when nothing declares the id.
export function monorepoCandidates(hits, roots, id) {
  const declared = new Set();
  const mentioned = new Set();
  for (const h of hits) {
    const root = nearestRoot(h.path, roots);
    if (!root) continue;
    const frags = h.fragments || [];
    if (frags.some((f) => declaresExactly(f, id))) declared.add(root);
    else if (frags.some((f) => mentionsExactly(f, id))) mentioned.add(root);
  }
  return { declared: [...declared].sort(), mentioned: [...mentioned].filter((r) => !declared.has(r)).sort() };
}

const at = (repo, folder) => `${repo}/${folder}`;

// The decision. Inputs:
//   id
//   standalone: [{ repo, archived }] repos whose workflows declare the id exactly
//               (never a monorepo)
//   docUrl:     parseGithubUrl(documentationUrl) or null
//   docRepo:    { repo, archived } for docUrl's repo when it is not a monorepo and
//               no workflow declared the id, else null (the last-resort guess)
//   monos:      one entry per monorepo that was looked at:
//               { repo, readable, error, searchError, truncated, roots, declared, mentioned }
//   folder:     a folder the operator passed with --folder: `<folder>` or
//               `<owner/monorepo>:<folder>`, or null
// Returns { location, hard: [reason], notes: [reason], predecessor }; location is
// { kind: 'repo'|'monorepo', repo, folder, source, predecessor } or null, and
// predecessor names the archived repo(s) even when no new home was found.
export function decideLocation({ id, standalone = [], docUrl = null, docRepo = null, monos = [], folder = null }) {
  const hard = [];
  const notes = [];
  const live = standalone.filter((s) => !s.archived).map((s) => s.repo);
  const archived = standalone.filter((s) => s.archived).map((s) => s.repo);
  // An archived documentation repo is a predecessor too: it says the component moved.
  if (!standalone.length && docRepo?.archived) archived.push(docRepo.repo);
  const predecessor = archived.length ? archived.join(', ') : null;
  const readable = monos.filter((m) => m.readable);
  const unreadable = monos.filter((m) => !m.readable);

  // 1. The monorepo folder, from the readable monorepos together.
  let pick = null;
  if (folder) {
    const [want, path] = folder.includes(':') ? folder.split(':', 2) : [null, folder];
    const hits = readable.filter((m) => (!want || m.repo === want) && (m.roots || []).includes(path));
    if (hits.length === 1) pick = { repo: hits[0].repo, folder: path, source: '--folder (operator)' };
    else if (hits.length > 1) hard.push(`--folder ${path} is a component folder in ${hits.map((m) => m.repo).join(' and ')}: pass it as <owner/monorepo>:${path}.`);
    else hard.push(`--folder ${folder} is not a component folder (no component_config/ there) of ${want || readable.map((m) => m.repo).join(' or ') || 'a readable monorepo'}.`);
  } else {
    const declared = readable.flatMap((m) => (m.declared || []).map((f) => ({ repo: m.repo, folder: f })));
    const mentioned = readable.flatMap((m) => (m.mentioned || []).map((f) => ({ repo: m.repo, folder: f })))
      .filter((x) => !declared.some((d) => d.repo === x.repo && d.folder === x.folder));
    const docMono = docUrl && docUrl.path ? readable.find((m) => m.repo === docUrl.repo) : null;
    const docRoot = docMono ? nearestRoot(docUrl.path, docMono.roots || []) : null;
    if (declared.length === 1) {
      pick = { ...declared[0], source: 'monorepo file that declares the id' };
    } else if (declared.length > 1) {
      hard.push(`${declared.length} monorepo folders declare ${id} (${declared.map((d) => at(d.repo, d.folder)).join(', ')}): confirm the right one with the owner and re-run with --folder <owner/monorepo>:<folder>.`);
    } else if (docRoot) {
      pick = { repo: docMono.repo, folder: docRoot, source: 'documentationUrl folder' };
    } else if (mentioned.length) {
      // A mention is not a declaration: the successor's README naming its
      // predecessor is the usual case. Never pick a folder on that alone.
      hard.push(`${id} is only mentioned, not declared, in ${mentioned.map((d) => at(d.repo, d.folder)).join(', ')}; that is often another component naming it. Confirm the folder with the owner and re-run with --folder <owner/monorepo>:<folder>.`);
    }
  }
  for (const m of readable) {
    if (m.truncated) notes.push(`The ${m.repo} tree or search was truncated; a component folder may be missing.`);
  }

  // 2. Pick, most specific first.
  let location = null;
  if (pick && live.length) {
    hard.push(`Both ${live.join(', ')} and ${at(pick.repo, pick.folder)} hold ${id}: a move is half done. Ask the owner which one publishes before writing anything.`);
  } else if (pick) {
    location = { kind: 'monorepo', repo: pick.repo, folder: pick.folder, source: pick.source, predecessor };
    if (predecessor) notes.push(`${predecessor} is archived; ${id} now lives in ${at(pick.repo, pick.folder)}.`);
    // A monorepo nobody could read may hold the same id: say so instead of guessing.
    if (unreadable.length) notes.push(`${unreadable.map((m) => m.repo).join(', ')} could not be read, so a second copy there was not ruled out.`);
  } else if (live.length === 1) {
    location = { kind: 'repo', repo: live[0], folder: '', source: 'workflow KBC_DEVELOPERPORTAL_APP', predecessor };
  } else if (live.length > 1) {
    hard.push(`${live.length} repositories declare ${id} in a workflow (${live.join(', ')}): pick the component's own repo by hand before anything else.`);
  } else if (!hard.length && !archived.length && docRepo) {
    // Last resort, as before the monorepos: the documentation link's repo. The
    // caller checks that it holds a component_config/.
    location = { kind: 'repo', repo: docRepo.repo, folder: '', source: 'documentationUrl (unverified: may be a docs repo, not the component repo)', predecessor: null };
  }

  // 3. Nothing found: say why, with the error behind each failed lookup.
  if (!location && !hard.length) {
    const why = [
      ...unreadable.map((m) => ` ${m.repo} could not be read${m.error ? ` (gh said: ${m.error})` : ''}.`),
      ...(unreadable.length ? [' A 404 means this gh account has no access; a 403 often means the token is not authorized for the organization\'s SSO.'] : []),
      ...readable.filter((m) => m.searchError).map((m) => ` The search in ${m.repo} failed (gh said: ${m.searchError}); re-run in a minute before concluding anything.`),
      ...readable.filter((m) => !m.searchError).map((m) => ` ${m.repo} has no folder that declares ${id}.`),
    ].join('');
    if (archived.length) hard.push(`${predecessor} is archived and the component's new home was not found.${why} Ask the Component Factory owner where ${id} lives now.`);
    else hard.push(`Could not resolve the component's repository: nothing to open a PR against.${why}`);
  }
  return { location, hard, notes, predecessor };
}
