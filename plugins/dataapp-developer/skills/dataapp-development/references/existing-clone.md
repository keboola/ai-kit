# Working in an existing clone

**Use this when:** you are about to read, describe, or push from a clone of an app's repo that you did not make just now — a reused folder, an earlier session's clone, a clone made before the draft existed.

A clone is a snapshot. The draft branch moves whenever anyone pushes, and the deployed container serves the **pushed** branch, not your working tree.

## Check, immediately before you read

Run this right before you describe the app's source, its endpoints, or how it stores data. A fetch from a few tool calls ago is already a guess:

```bash
git status --porcelain                         # prints what is dirty, if anything
[ -z "$(git status --porcelain)" ] || exit 1   # and stops if it is: settle it, then start over
git fetch --prune origin || exit 1
git checkout <branch> || exit 1
git rev-list --left-right --count HEAD...origin/<branch>   # -> "<ahead>\t<behind>"
```

- **The status gate stops on any uncommitted edit.** A dirty edit to a file the branches agree on lets the checkout succeed and rides onto the draft branch, and the counts then read a clean `0 0`.
- **Fetch before the checkout.** A clone made before the draft existed has no local `<branch>`. Fetching creates `origin/<branch>` and never touches the tree.
- **A failed fetch is a hard stop** — `|| exit 1`, not `|| echo`. After a failed fetch the old refs can report `0 0`. Say you could not reach the repository instead of describing the source.
- **`--prune`** drops refs to branches deleted on origin. Publishing deletes the draft branch, and a stale `origin/<branch>` would report `0 0`.
- **Checkout before the count.** Publishing ends on `main`, so a reused clone often sits there, and the count would compare `main` with the draft.
- **`rev-list`, not `git status -sb`.** `status -sb` shows no counts on a branch without an upstream, even when you are behind.
- **When the checkout fails**, key on `pathspec`: `pathspec ... did not match` after a successful fetch means there is no `origin/<branch>` (see "The branch is gone" below); any other failure is the tree blocking the switch — settle it (dirty tree, below) and retry.

## Read the result

- **Dirty tree** — settle it first, whatever the counts say: those edits are not deployed. Check which branch you are on before committing, since app code never goes onto `main` directly. If the checkout refuses because of these edits, `git stash -u`, switch, then `git stash pop` (`-u` moves untracked files too). Run the check again.
- **`0 N` — behind.** `git merge --ff-only origin/<branch>`, then re-read the files.
- **`N 0` — ahead.** Your local commits are not deployed. Push before you claim the app behaves the way your tree reads.
- **`N M` — diverged.** Two versions of the app exist. Ask the user which one they mean; never pick one silently.
- **`0 0` and a clean tree** — the tree matches the remote. Answer from it.

When what you read contradicts what the app does, trust the running app: a request to it, or the terminal log in `get_data_apps`, beats a local file read. When the user pushes back on a claim about their code, run the check again before you restate it.

## The branch is gone

`rev-list` fails with `unknown revision` when `origin/<branch>` does not exist. Either the branch was never pushed, or a publish merged and deleted it. Git cannot tell which, so do not guess from history: `get_data_apps` on the prod app says whether it was ever deployed, and its `drafts` list what still exists.

Either way the local branch is not the deployed source. After a publish the deployed source is `origin/main`: read it with `git show origin/main:<path>`, or `git diff HEAD origin/main` for an overview. To update a local `main`, check it out first: `merge --ff-only` moves whatever is checked out.
