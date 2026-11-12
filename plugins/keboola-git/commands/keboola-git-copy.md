---
name: keboola-git-copy
description: Copy a data app's source between GitHub and Keboola-managed Git (Forgejo) in either direction, handling the ~15MB/HTTP 413 push cap via build-at-deploy.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
argument-hint: "to-keboola|to-github --source <repo-url-or-path> --branch <branch> --project <alias> [--app-id <id>] [--app-name <name>]"
---

# Copy a Data App Repo: GitHub ↔ Keboola Git

Bidirectional copy of a python-js data app's source between GitHub and a Keboola-managed
Forgejo repo. **First, use the `keboola-git` skill** for the full kbagent command catalog,
credential handling, and the 413 / build-at-deploy recipe — this command is the procedure
that drives it.

## Arguments

- **direction** (positional): `to-keboola` (GitHub → Keboola) or `to-github` (Keboola → GitHub).
- `--source` — source repo URL or local path (for `to-keboola`), or the GitHub scratch repo URL (for `to-github`).
- `--branch` — source branch to clone (`to-keboola`) or destination scratch/feature branch (`to-github`).
- `--project` — kbagent project alias.
- `--app-id` — `app_id` of an existing app (optional; provision a new one if absent).
- `--app-name` — display name when provisioning a new app (`to-keboola` only).

## Setup (both directions)

1. Ensure prerequisites: `kbagent --version`, project registered, `export KBAGENT_CONVERSATION_ID=$(uuidgen)`.
2. Do all git work under `./.keboola-git-work/` in the user's CWD; ensure `.keboola-git-work/` is gitignored.
3. Pass `--json` to kbagent when you parse its output (it is under `.data`). Never print, commit or log the push credential.
4. Each command you run starts a new shell, so a shell variable does not reach the next step. Mint the credential and use it (`git remote add` / `git clone`) in **one** command; later steps use the `keboola` remote by name.

---

## `to-keboola` (GitHub → Keboola)

0. **Offer not copying first.** When `--source` is a GitHub `https://` URL, tell the user the app can deploy
   straight from that repo with organization auth instead: no copy, no PAT, no 15MB cap, but prod mode only
   (no drafts or preview yet). It needs the Keboola GitHub App installed on the GitHub organization and that
   organization connected to the Keboola organization, by a Keboola organization admin who owns the GitHub
   organization (https://help.keboola.com/management/organization/#connect-github). Have the user confirm both: a missing connection only fails at
   deploy (`create --wait` then deletes the new app unless `--keep-on-failure`). If they choose it:
   - **No app yet** (or the user agrees to a new one): `kbagent data-app create --project <alias> --name <app-name>
     --slug <slug> --git-repo <url> --git-auth organization --git-branch <branch> --type python-js --wait`.
     It deploys as part of the call.
   - **An existing app on an external repo (PAT / SSH key):** `kbagent data-app git-auth-set --project <alias>
     --app-id <id> --git-auth organization`, then `kbagent data-app deploy --project <alias> --app-id <id> --wait`.
   - **An existing app on a Keboola-managed repo** (`--app-id` given, or one found in step 1) can't switch.
     Creating a new app means a second app next to it, so only do that with the user's yes. Otherwise continue
     with step 1.

   Stop here once the org-auth app deploys. Details: the `keboola-git` skill, §Source already on GitHub?
   Continue with step 1 when they want the managed repo.
1. **Resolve the app. Creating one is the last resort.**
   - If `--app-id` given: confirm it with `kbagent --json data-app list --project <alias>`.
   - Else run `data-app list`. It also shows drafts, so check each python-js app with
     `data-app git-repo`: the prod app on a managed repo has `is_managed_git_repo: true`, a draft
     has `false`. Exactly one such prod app means use it, however empty it looks. Several means
     ask the user which.
   - Only when the project has **no** python-js app on a managed repo: create it with
     `data-app create --type python-js --use-managed-git-repo` (use `--app-name`), and say so in
     your reply first. It creates an app **and a managed repo that can never be attached to an
     existing app afterwards**.
   - Capture `app_id`.
   - This command copies onto the prod app's `main`. To stage changes on a branch behind a
     preview instead, use the drafts flow in
     `plugins/dataapp-developer/skills/dataapp-development/references/python-js-prod-and-drafts.md`
     rather than this command.
2. **Clone the source** (single-branch) into `./.keboola-git-work/app`.
3. **Mint a push credential and add the `keboola` remote, in one command**, from inside the clone:
   the block in the `keboola-git` skill, §2. It stops with kbagent's error when the call fails
   (403: not an admin token, 409: not a managed repo).
4. **Size guard (working tree):** `find . -size +15M -not -path '*/.git/*'`.
   - If a committed build is found (e.g. `frontend/.next`), apply **source-only + build-at-deploy**:
     untrack + gitignore the build dir and `node_modules/`; set `keboola-config/setup.sh` to
     `cd frontend && npm ci && npm run build`, then copy `static` + `public` to wherever the build
     put `server.js` (`find .next/standalone -name server.js` — single-package vs monorepo differ).
     Commit the source-only tree. (See the `dataapp-developer:dataapp-development` skill for setup.sh wiring.)
   - Re-run the working-tree guard; it must return nothing.
5. **History guard (CRITICAL):** a build committed in an earlier commit still 413s — `git push`
   sends all reachable history, the `find` guard only sees the working tree. Check:
   `git rev-list --objects HEAD | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' | awk '$1=="blob" && $2>15000000'`.
   If non-empty: push an `--orphan` clean commit (fresh managed repo) or `git filter-repo`/BFG (preserve history).
6. **Push:** join the repo's initial commit (the join step in
   `skills/keboola-git/references/managed-git.md`, clone / push pattern), then
   `git push keboola HEAD:main` (or `clean-main:main` if you orphaned).
   - A new app's repo starts with one commit on `main`; without the join the push is rejected
     as non-fast-forward. Never force-push past it.
   - On `HTTP 413`, re-run **both** guards and **report the offending file** — it can't be split; ask the user how to externalize it.
7. **Offer to deploy + verify:** `kbagent data-app deploy --project <alias> --app-id <id> --git-branch main --wait`, then tail logs (`data-app logs`) (`setup_sh` ~2min) and confirm
   from the logs — `✓ Compiled successfully`, `Completed: setup_sh` (static `cp` worked), and
   `success: node-frontend entered RUNNING` + `Ready in`. Don't trust an HTTP probe: unauthenticated
   `GET /` returns the platform login gate (200), and `POST /` 200 is just the nginx health rule.
   A `python-api` crash loop on a Storage `404` is an expected data error in an empty project, not a deploy failure.

## `to-github` (Keboola → GitHub)

1. **Resolve the app:** `data-app list` (or use `--app-id`) → `app_id`.
2. **Mint a credential and clone, in one command** (readOnly is enough here): the block in the `keboola-git` skill, §2,
   with its last line replaced by the `git clone` of managed `main` into `./.keboola-git-work/app`.
3. **Add the GitHub remote:** `git remote add github <--source scratch repo url>`.
4. **Push to the user-specified scratch/feature branch only:**
   `git push github main:<--branch>`.
   - **Confirm before any push to a shared repo or default branch.** Never force-push.

---

## Guardrails

- Never write to a shared/production GitHub repo without explicit confirmation; default to a user-owned scratch repo + feature branch.
- Never force-push. The managed repo refuses deleting its default branch — `main`, because this command pushes it first.
- Treat the push credential as a one-time secret: never print it (that includes `git remote -v`), `git remote remove keboola` when done, rotate if exposed.
- Backend *data* errors after a successful deploy (missing Storage tables) are expected in empty projects and are not copy/deploy failures.
