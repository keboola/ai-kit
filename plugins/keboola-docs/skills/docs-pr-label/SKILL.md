---
name: docs-pr-label
description: "Use after opening or updating a keboola/connection-docs pull request, or when asked to label PRs: adds the section and site-tooling labels that its ticket and changed files call for. A hook runs it after every gh pr create."
---

# Label a docs PR


## Working Directory Context

`scripts/label-pr.mjs` runs from anywhere: it talks to GitHub through `gh` and reads `rules.json` next to itself. `--repo=owner/name` overrides the repository in `rules.json`.

## Overview

Every PR in keboola/connection-docs should carry the label of the work it belongs to, so a
reviewer can filter the Getting Started stack or the Apps work, and the reviewer bot routes
tooling changes to a human. The rules live in `rules.json`; `scripts/label-pr.mjs` applies them.

The script only adds labels that already exist in the repo. It never creates a label, never
removes one, and leaves PRs by other authors alone (`rules.json` `authors`: a list of GitHub logins, or `[]` for whoever is logged into `gh`) (we touch only our own
PRs).

## When it runs

- **Automatically**, after any `gh pr create`: the plugin's PostToolUse hook on Bash
  (`scripts/pr-label.sh`) runs this script. The hook prints what it added.
- **By hand**, after a push that changes which section a PR mostly touches, or to sweep:
  ```bash
  L="${CLAUDE_PLUGIN_ROOT}/skills/docs-pr-label/scripts/label-pr.mjs"
  node $L 1187 1185                 # dry run: what would be added, and why
  node $L --apply 1187              # add them
  node $L --all-mine                # dry run over every open PR by the authors in rules.json
  node $L --preview --title "<title>" --branch <b> --files a.md,b.mjs   # before the PR exists (docs-ship)
  ```

## The rules (rules.json)

| Label | Given when |
|---|---|
| `getting-started` | the title or branch names PRDCT-487, or (no ticket match) at least 30% of the changed files are Getting Started pages, media or components |
| `apps-ga` | the title or branch names PRDCT-692 or AJDA-3380, or (no ticket match) at least 30% of the changed files are under `data-apps` |
| `site-tooling` | any changed file is under `scripts/`, `src/integrations/`, `api/`, `.github/`, or is `astro.config.mjs`, `package.json`, `package-lock.json`, `vercel.json` |

A ticket match wins over file shares, so a Getting Started PR that fixes two links on an Apps
page stays `getting-started` only. To add a section, add an entry to `sections` with its label
(create the label in the repo first, with a maintainer's OK), its tickets and its paths.

## Common mistakes

| Mistake | Fix |
|---|---|
| Creating a label because the script says "not in the repo" | Ask a maintainer; labels are repo-wide and the reviewer bot reads some of them |
| Running `--all-mine --apply` as a first step | Dry-run it, show the list, apply only what was agreed |
| Expecting it to label someone else's PR | It skips them on purpose; never label others' PRs |
