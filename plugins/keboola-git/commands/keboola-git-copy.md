---
name: keboola-git-copy
description: Copy a data app's source between GitHub and Keboola-managed Git (Forgejo) in either direction, handling the ~15MB/HTTP 413 push cap via build-at-deploy.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
argument-hint: "to-keboola|to-github --source <repo-url-or-path> --branch <branch> --project <alias> [--config <cfg>] [--app-name <name>]"
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
- `--config` — `configuration_id` of an existing app (optional; provision a new one if absent).
- `--app-name` — display name when provisioning a new app (`to-keboola` only).

## Setup (both directions)

1. Ensure prerequisites: `kbagent --version`, project registered, `export KBAGENT_CONVERSATION_ID=$(uuidgen)`.
2. Do all git work under `./.keboola-git-work/` in the user's CWD; ensure `.keboola-git-work/` is gitignored.
3. Always pass `--json` to kbagent `tool call`. Keep any `git_clone_url` in a shell variable only — never commit or log it.

---

## `to-keboola` (GitHub → Keboola)

1. **Resolve or provision the app.**
   - If `--config` given: confirm with `get_data_apps` and read its `data_app_id` / `repo_url`.
   - Else: provision with `modify_python_js_data_app` (use `--app-name`); capture `configuration_id`, `data_app_id`, `repo_url`.
2. **Mint a push credential** with `create_python_js_data_app_git_credential` → `git_clone_url` into `$URL`.
3. **Clone the source** (single-branch) into `./.keboola-git-work/app`.
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
6. **Push:** `git remote add keboola "$URL" && git push keboola HEAD:main` (or `clean-main:main` if you orphaned).
   - On `HTTP 413`, re-run **both** guards and **report the offending file** — it can't be split; ask the user how to externalize it.
7. **Offer to deploy + verify:** `deploy_data_app`, then tail logs (`setup_sh` ~2min) and confirm
   from the logs — `✓ Compiled successfully`, `Completed: setup_sh` (static `cp` worked), and
   `success: node-frontend entered RUNNING` + `Ready in`. Don't trust an HTTP probe: unauthenticated
   `GET /` returns the platform login gate (200), and `POST /` 200 is just the nginx health rule.
   A `python-api` crash loop on a Storage `404` is an expected data error in an empty project, not a deploy failure.

## `to-github` (Keboola → GitHub)

1. **Resolve the managed repo:** `get_data_apps` (or use `--config`) → `repo_url`, `data_app_id`.
2. **Mint a credential** → `$URL`; **clone** managed `main` into `./.keboola-git-work/app`.
3. **Add the GitHub remote:** `git remote add github <--source scratch repo url>`.
4. **Push to the user-specified scratch/feature branch only:**
   `git push github main:<--branch>`.
   - **Confirm before any push to a shared repo or default branch.** Never force-push.

---

## Guardrails

- Never write to a shared/production GitHub repo without explicit confirmation; default to a user-owned scratch repo + feature branch.
- Never force-push; the Forgejo pre-receive hook also declines branch deletes.
- Treat any `git_clone_url` / credential as a one-time secret: shell var only, rotate if exposed.
- Backend *data* errors after a successful deploy (missing Storage tables) are expected in empty projects and are not copy/deploy failures.
