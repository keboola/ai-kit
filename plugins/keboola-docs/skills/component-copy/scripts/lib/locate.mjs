// Where a component's copy lives: one repository and, in a monorepo, one folder.
//
// In November 2026 the Component Factory moved most components into the private
// monorepo keboola/components and archived the old keboola/component-* repos (see
// the keboola/component-ci README, "Monorepo workflows"). A component can now be
// in its own repo (repo root), in a monorepo folder, or in both while a move is
// half done. component-facts.mjs gathers the evidence through gh; the functions
// here only decide, so they can be tested without the network.
export const MONOREPO = 'keboola/components';

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

// Which folders of the monorepo hold the component, from search hits
// ({ path, fragments }) and the component roots of the tree. Declaring hits win;
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

// The decision. Inputs:
//   id
//   standalone: [{ repo, archived }] repos whose workflows declare the id exactly
//               (never the monorepo itself)
//   docUrl:     parseGithubUrl(documentationUrl) or null
//   docRepo:    { repo, archived } for docUrl's repo when it is not the monorepo and
//               no workflow declared the id, else null (the last-resort guess)
//   mono:       { readable, error, searchError, truncated, roots, declared, mentioned }
//               or null when the monorepo was not looked at
//   folder:     a folder the operator passed with --folder, or null
// Returns { location, hard: [reason], notes: [reason], predecessor }; location is
// { kind: 'repo'|'monorepo', repo, folder, source, predecessor } or null, and
// predecessor names the archived repo(s) even when no new home was found.
export function decideLocation({ id, standalone = [], docUrl = null, docRepo = null, mono = null, folder = null }) {
  const hard = [];
  const notes = [];
  const live = standalone.filter((s) => !s.archived).map((s) => s.repo);
  const archived = standalone.filter((s) => s.archived).map((s) => s.repo);
  // An archived documentation repo is a predecessor too: it says the component moved.
  if (!standalone.length && docRepo?.archived) archived.push(docRepo.repo);
  const predecessor = archived.length === 1 ? archived[0] : archived.length ? archived.join(', ') : null;
  const docRoot = mono?.readable && docUrl?.repo === MONOREPO && docUrl.path
    ? nearestRoot(docUrl.path, mono.roots || []) : null;

  // 1. The monorepo folder, when the monorepo was readable.
  let monoFolder = null;
  let monoSource = null;
  if (mono?.readable) {
    if (folder) {
      if ((mono.roots || []).includes(folder)) { monoFolder = folder; monoSource = '--folder (operator)'; }
      else hard.push(`--folder ${folder} is not a component folder of ${MONOREPO} (no component_config/ there).`);
    } else if (mono.declared?.length === 1) {
      monoFolder = mono.declared[0]; monoSource = 'monorepo file that declares the id';
    } else if (mono.declared?.length > 1) {
      hard.push(`${mono.declared.length} folders of ${MONOREPO} declare ${id} (${mono.declared.join(', ')}): confirm the right one with the owner and re-run with --folder <folder>.`);
    } else if (docRoot) {
      monoFolder = docRoot; monoSource = 'documentationUrl folder';
    } else if (mono.mentioned?.length) {
      // A mention is not a declaration: the successor's README naming its
      // predecessor is the usual case. Never pick a folder on that alone.
      hard.push(`${id} is only mentioned, not declared, in ${MONOREPO} (${mono.mentioned.join(', ')}); that is often another component naming it. Confirm the folder with the owner and re-run with --folder <folder>.`);
    }
    if (mono.truncated) notes.push(`The ${MONOREPO} tree listing was truncated; a component folder may be missing from the roots.`);
  }

  // 2. Pick, most specific first.
  let location = null;
  if (monoFolder && live.length) {
    hard.push(`Both ${live.join(', ')} and ${MONOREPO}/${monoFolder} hold ${id}: a move is half done. Ask the owner which one publishes before writing anything.`);
  } else if (monoFolder) {
    location = { kind: 'monorepo', repo: MONOREPO, folder: monoFolder, source: monoSource, predecessor };
    if (predecessor) notes.push(`${predecessor} is archived; ${id} now lives in ${MONOREPO}/${monoFolder}.`);
  } else if (live.length === 1) {
    location = { kind: 'repo', repo: live[0], folder: '', source: 'workflow KBC_DEVELOPERPORTAL_APP', predecessor };
  } else if (live.length > 1) {
    hard.push(`${live.length} repositories declare ${id} in a workflow (${live.join(', ')}): pick the component's own repo by hand before anything else.`);
  } else if (!hard.length && !archived.length && docRepo) {
    // Last resort, as before the monorepo: the documentation link's repo. The caller
    // checks that it holds a component_config/.
    location = { kind: 'repo', repo: docRepo.repo, folder: '', source: 'documentationUrl (unverified: may be a docs repo, not the component repo)', predecessor: null };
  }

  // 3. Nothing found: say why, with the error that caused it when there was one.
  if (!location && !hard.length) {
    const why = !mono ? ''
      : !mono.readable ? ` ${MONOREPO} could not be read${mono.error ? ` (gh said: ${mono.error})` : ''}; a 404 means this gh account has no access, a 403 often means the token is not authorized for the organization's SSO.`
      : mono.searchError ? ` The search in ${MONOREPO} failed (gh said: ${mono.searchError}); re-run in a minute before concluding anything.`
      : ` ${MONOREPO} has no folder that declares ${id}.`;
    if (archived.length) hard.push(`${predecessor} is archived and the component's new home was not found.${why} Ask the Component Factory owner where ${id} lives now.`);
    else hard.push(`Could not resolve the component's repository: nothing to open a PR against.${why}`);
  }
  return { location, hard, notes, predecessor };
}
