---
name: docs-ship
description: "Use only after the author says ok (\"ок\", \"ship it\", \"открывай PR\") to a docs-page, docs-update or docs-retire commit: pushes the branch and opens the keboola/connection-docs pull request from the handoff, as a draft when something is unverified. Never merges and never touches someone else's PR."
---

# docs-ship: push and open the PR, on "ok" only

## Overview

The three authoring skills end with a local commit and the sentence "say ok to ship". This skill
is that step. It exists so the PR is never a side effect: the author reads the handoff, says ok,
and only then does anything leave the machine.

## Preconditions

- The author's "ok" is in the conversation, after the commit it refers to. An ok given for the
  page map or the media list is not an ok to ship.
- `git status` is clean and the branch is not `main`.
- Everything that will ship was in a handoff: list `git log --oneline <base>..HEAD`. A commit the
  author has not seen (a rebase leftover, a helper commit) is named, and the push waits for an ok
  that covers it.
- The commits passed the gate: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/gate-verdict.mjs" <worktree>`.
  It finds the gate's decision for `HEAD^{tree}` in every `keboola-docs-*` log (the log folder depends on
  how the plugin was loaded: `keboola-docs-<marketplace>` or `keboola-docs-inline`). Exit 0 `allow` is fine;
  exit 3 `skip` means say which check was skipped and get the ok again; exit 1 (deny, or no entry: the
  commit bypassed the gate) means re-run it with `git commit --amend --no-edit`, which the gate judges
  against HEAD's parent without changing the content.
- The PR is the author's own (the plugin ships with `docs-pr-label/rules.json` naming the
  authors it labels for). Never push to, rebase or comment on another person's branch.

## Steps

1. Pick the remote, then push: the remote whose URL is keboola/connection-docs when
   `gh repo view keboola/connection-docs --json viewerPermission` says WRITE, MAINTAIN or ADMIN
   (branches live on the main repo then), otherwise the author's fork. Name the remote and the
   resulting head (`keboola:<branch>` or `<fork-owner>:<branch>`) before pushing:
   `git push -u <remote> <branch>`. On a stacked branch (base is another PR's branch), say so and
   pass `--base`.
2. Build the body from `references/pr-body.md`: fill every `<…>` from the state file
   (`${CLAUDE_PLUGIN_DATA}/docs-page/<repo-dir>--<branch>.md`) and `git diff --stat
   <base>...HEAD`. Sections with nothing to say are dropped, not left as placeholders.
3. Preview the labels before the PR exists:
   `node "${CLAUDE_PLUGIN_ROOT}/skills/docs-pr-label/scripts/label-pr.mjs" --preview --title "<title>"
   --branch <branch> --files "$(git diff --name-only <base>...HEAD | paste -sd, -)"`, and show them
   with the title and the draft decision.
4. `gh pr create --title "<title>" --body-file <scratch>/pr-body.md [--base <branch>] [--draft]`.
   The title is `PRDCT-nnn: <title>` with a ticket and `<section>: <title>` without one; the body's
   Why says "no ticket" instead of a Linear id. `--draft` when any VERIFY on the diff has no answer
   yet, when a stop was skipped, when the guide-tester only did a cold read of a how-to or tutorial,
   or when the author said "draft".
5. The plugin's PostToolUse hook runs `docs-pr-label` and prints the labels it added (the ones the
   preview showed). If it printed nothing, run `label-pr.mjs --apply <url>` by hand.
6. Print the PR URL. Bind it to the session when the host has `ccd_pr` tools. Update the state
   file (`pr: <url>`). Do not request reviewers unless the author named them.

## Never

- Merge, enable auto-merge, or re-trigger review bots without a separate ok.
- Open a PR for a commit the author has not seen in a handoff block.
- Push over a rejected gate: a `DOCS_GATE=skip` commit ships only after the author repeats the ok
  knowing which check was skipped.
