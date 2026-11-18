// Where a component's PR can go once its repo turns out to be archived.
//
// In November 2026 the Component Factory moved most component repos into the
// private monorepo keboola/components and archived the old ones (see the
// keboola/component-ci README, "Monorepo workflows"). An archived repo is
// read-only: no PR, and its old push.yml says nothing about how the copy
// publishes now.
export const MONOREPO = 'keboola/components';

// Folders of the monorepo that mention the component, from code-search paths:
// the shortest folder above each hit that has a component_config/ in its path,
// or the hit's own folder.
export function monorepoFolders(paths) {
  const dirs = paths.map((p) => {
    const i = p.indexOf('/component_config/');
    if (i > -1) return p.slice(0, i);
    const j = p.lastIndexOf('/');
    return j > -1 ? p.slice(0, j) : '.';
  });
  return [...new Set(dirs)].sort();
}

// Gate entries for an archived repo. `monorepo` is { access, folders } or null
// when it was not checked. Returns [level, reason] pairs; level is 'hard' or
// 'note' (a note is information, not a block).
export function archivedVerdict({ id, repo, archived, monorepo }) {
  if (!repo || !archived) return [];
  if (!monorepo || !monorepo.access) {
    return [['hard', `${repo} is archived (read-only), so no PR can go there. Component repos moved to the private monorepo ${MONOREPO} in November 2026 and this gh account cannot read it. Ask the Component Factory owner for access, then re-run.`]];
  }
  if (!monorepo.folders.length) {
    return [['hard', `${repo} is archived and ${id} was not found in ${MONOREPO}: ask the Component Factory owner where the component lives now.`]];
  }
  if (monorepo.folders.length > 1) {
    return [['hard', `${repo} is archived and ${id} appears in ${monorepo.folders.length} folders of ${MONOREPO} (${monorepo.folders.join(', ')}): pick the component's own folder by hand.`]];
  }
  return [['note', `${repo} is archived; the component now lives in ${MONOREPO} at ${monorepo.folders[0]}/. Open the PR there.`]];
}
