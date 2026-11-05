---
name: keboola-git
description: >-
  Use when accessing a Keboola-managed Git (Forgejo) repo for a python-js data app via the kbagent CLI — provisioning the repo, finding its repo_url, minting a git_clone_url / push credential with create_python_js_data_app_git_credential, pushing source to Keboola git, copying source between GitHub and Keboola git, working around the ~15MB / HTTP 413 push cap with build-at-deploy, deploying a data app from its managed git repo, or deciding whether to copy a GitHub repo into Keboola git or deploy straight from GitHub with organization auth (no PAT). Triggers: kbagent, Keboola managed git, Forgejo, data app repo, repo_url, git_clone_url, create git credential, push to Keboola git, build-at-deploy, HTTP 413, deploy from git, organization GitHub auth.
allowed-tools: ['*']
---

# Keboola-Managed Git (Forgejo) for Data Apps

Keboola python-js data apps can host their source in a **Keboola-managed Git repo (Forgejo)** instead of GitHub. This skill gives you the context to access those repos through the `kbagent` CLI: provision a repo, mint a push credential, push source in with raw `git`, and deploy. kbagent has **no repo-copy helper** — you drive `git clone` / `git remote add` / `git push` yourself.

## What this does / when not

**Use this for:** reading or writing a managed Forgejo repo for a python-js data app; moving an app's source between GitHub and Keboola git; pushing source and deploying from the managed repo.

**Not for:** authoring the contents of `keboola-config/` (nginx, supervisord, setup.sh) — that's the `dataapp-developer:dataapp-development` skill, which also covers Streamlit app development. This skill assumes the app source already exists somewhere; it handles the *git plumbing* to get it into Keboola and deployed.

## Source already on GitHub? Consider not copying it

If the app's source is in a GitHub repo (`github.com`, or a GHE host the stack is configured for; the MCP takes only `*.ghe.com` ones), the app can deploy **straight from that repo with organization auth**. The platform reads it through the Keboola organization's GitHub App connection, so there is no copy into Keboola git, no PAT and no 15MB push cap. Offer it before copying, and before asking for a PAT or SSH key:

```bash
# a new app on the GitHub repo -- create deploys it, no separate deploy
kbagent data-app create --project <alias> --name "<Display Name>" --slug <slug> \
  --git-repo https://github.com/<org>/<repo> --git-auth organization --git-branch main --type python-js --wait

# an existing app already on an EXTERNAL repo (PAT / SSH key) -- git-auth-set never deploys
kbagent data-app git-auth-set --project <alias> --app-id <id> --git-auth organization
kbagent data-app deploy --project <alias> --app-id <id> --wait
```

**An app on a Keboola-managed repo can't switch.** The managed repo is fixed when the app is created, and both `git-auth-set` and the MCP rebind refuse it. Every app created from the Keboola Apps page is one. For such an app, either copy the code into its managed repo (the rest of this skill), or create a new app on the GitHub repo, but only once the user agrees to a second app next to the managed one.

Confirm the prerequisites before creating: a missing connection only shows up at deploy time. `create --wait` then deletes the new app again (unless `--keep-on-failure`), so the user ends up with nothing deployed.

Through MCP it's `modify_python_js_data_app(git_repository="https://github.com/<org>/<repo>", git_auth="organization", branch="main")`. Prerequisites: the Keboola GitHub App installed on the GitHub organization and that organization connected to the Keboola organization, both done by someone who is a Keboola organization admin and an owner of the GitHub organization (https://help.keboola.com/management/organization/#connect-github). Limits: https URLs only, github.com or a GHE host the stack is configured for, read-only, prod mode only (no dev mode, preview or drafts yet). The app has no managed repo, so the rest of this skill doesn't apply to it. Copy into Keboola git instead when the user wants drafts and previews, the repo isn't on GitHub, or the organization can't be connected. Details and errors: `plugins/dataapp-developer/skills/dataapp-development/references/github-organization-auth.md`.

## Working Directory Context

All `git` and `kbagent` operations run from the **user's project root** or a **scratch clone created under the user's CWD** — never from this skill/plugin directory.

- Do clone/copy work in `./.keboola-git-work/<app>/` under the user's CWD. Add `.keboola-git-work/` to the project `.gitignore` so the scratch clone is never committed.
- Before any in-place git operation on an existing repo, validate it's a worktree: `git rev-parse --is-inside-work-tree`.
- Never run git commands against the plugin install directory.

## Prerequisites

1. **kbagent installed** and on `PATH` (`kbagent --version`). Install the `kbagent` plugin from this marketplace with `/plugin install kbagent@keboola-claude-kit`, then run `/kbagent:setup` to install the CLI. Usage: the `kbagent:kbagent` skill.
2. **Project registered** with kbagent (one-time per project):
   ```bash
   kbagent --json project add --project <alias> --url <stack-url> --token-env KBC_TOKEN
   ```
3. **Conversation id** exported once per shell session:
   ```bash
   export KBAGENT_CONVERSATION_ID=$(uuidgen)
   ```
4. **Always pass `--json`** to tool calls so you can parse `configuration_id`, `repo_url`, `git_clone_url` reliably.

## 1. Access the managed repo

**Existing app** — find its repo and config:
```bash
kbagent --json tool call get_data_apps --project <alias> --input '{}'
```
Note the `configuration_id`, `data_app_id`, and `repo_url`
(`https://git.<stack>/keboola/app-<data_app_id>.git`).

**Create a prod app + repo — only when `get_data_apps` above returned no python-js app:**
```bash
kbagent --json tool call modify_python_js_data_app --project <alias> \
  --input '{"name":"<Display Name>","slug":"<slug>","description":"<desc>"}'
```
Returns `configuration_id`, `data_app_id`, `repo_url`.

**An empty `configuration_id` creates, every time.** It makes a new prod app *and* a new
managed repo, and the repo can never be attached to an existing app afterwards, so a stray
prod app is a stray repo. Look before you create, and when your context already names the app
(the page you were opened on, an id in the request) just use that id.

This skill's flow below targets the prod app's `main`. To stage changes on a branch behind a
preview instead, the draft flow (`parent_configuration_id`, `deploy_data_app` in dev mode)
is in `plugins/dataapp-developer/skills/dataapp-development/references/python-js-prod-and-drafts.md`.

## 2. Mint a push credential (one-time secret)

```bash
kbagent --json tool call create_python_js_data_app_git_credential --project <alias> \
  --input '{"configuration_id":"<cfg>"}'
```
Returns `git_clone_url` = `https://kai:<secret>@git.<stack>/keboola/app-<data_app_id>.git`.
Always mint against the **prod** config. Drafts own no repo of their own.

- The secret is **shown once**. Mint a fresh one anytime — they're cheap and revocable-by-rotation.
- **Keep it in a shell variable only.** Never commit it, never `echo` it into a file, never paste it into a log or message. Read it into a var and reference `"$URL"`:
  ```bash
  URL='https://kai:<secret>@git.<stack>/keboola/app-<id>.git'
  ```

## 3. Clone / push pattern (raw git)

```bash
mkdir -p ./.keboola-git-work && cd ./.keboola-git-work
git clone --single-branch --branch <branch> <source-repo> app && cd app
git remote add keboola "$URL"
# A new app's repo starts with one commit on `main` (Forgejo's README.md). Join it so the
# push is a fast-forward; on a conflict your files win. An older app's repo may be empty:
# then there is nothing to join. More than one commit means `main` already has app code:
# stop and ask the user instead of pushing over it.
if git ls-remote --exit-code --heads keboola main >/dev/null; then
  git fetch keboola main
  if [ "$(git rev-list --count FETCH_HEAD)" = 1 ]; then
    git merge --allow-unrelated-histories -X ours --no-edit FETCH_HEAD
  else
    echo "STOP: main already has app code"
  fi
fi
git push keboola HEAD:main   # skip when the step above printed STOP
```
- **A new app's repo is not empty**: it starts with one initial commit on `main`, so join it (above) before the first push, or the push is rejected. Never force-push past it.
- **The repo's default branch cannot be deleted**; any other branch can. On a new app's repo the default is `main`. On an older, empty repo the first branch pushed becomes the default, so push `main` first.
- Never force-push a shared/managed branch — the server does not block it.
- Reusing a clone? Check it before you read or push from it: the existing-clone reference of the `dataapp-developer:dataapp-development` skill.

## 4. The 15MB / HTTP 413 cap + build-at-deploy (CRITICAL)

Forgejo rejects pushes over **~15MB** with **HTTP 413**. A single file over the limit cannot be split — you must not track it.

**Push source only.** Repos that commit their build (e.g. `frontend/.next` ~55MB, often including a 15.3MB macOS `sharp` binary that's also the *wrong* binary for the Linux runtime) must move the build into deploy time:

1. Size guard before pushing:
   ```bash
   find . -size +15M -not -path '*/.git/*'
   ```
2. If a build dir is tracked, stop tracking it and gitignore it:
   ```bash
   git rm -r --cached frontend/.next
   printf '%s\n' 'frontend/.next/' 'node_modules/' >> .gitignore
   ```
3. Move the build into `keboola-config/setup.sh` so it runs in the Linux container at deploy:
   ```bash
   # in keboola-config/setup.sh, run from the app's frontend dir:
   cd frontend && npm ci && npm run build
   # Next.js output:'standalone' does NOT copy static assets — copy them so the
   # standalone server.js can serve them. The destination MIRRORS the path from the
   # Next.js workspace root, so it differs by layout — detect where server.js landed:
   #   find .next/standalone -maxdepth 3 -name server.js
   # Single-package repo (workspace root == frontend/, server.js at .next/standalone/server.js):
   cp -r .next/static .next/standalone/.next/static
   cp -r public       .next/standalone/public
   # Monorepo (workspace root above frontend/, server.js at .next/standalone/frontend/server.js):
   #   cp -r .next/static .next/standalone/frontend/.next/static
   #   cp -r public       .next/standalone/frontend/public
   ```
   For the exact setup.sh / nginx / supervisord wiring, cross-reference the **`dataapp-developer:dataapp-development`** skill.
4. Commit the source-only tree, then re-run the size guard (no tracked file >15MB).

5. **Check git *history*, not just the working tree (CRITICAL).** `git push` sends every
   object reachable from the pushed ref — so a build committed in an *earlier* commit still
   gets pushed and still 413s, even after step 2 removes it from `HEAD`. The `find` guard only
   sees the working tree. Check reachable blobs:
   ```bash
   git rev-list --objects HEAD \
     | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' \
     | awk '$1=="blob" && $2>15000000 {print $2, $3}'
   ```
   If anything prints, the over-cap blob is in history. Two remedies:
   - **Fresh managed repo (the common case):** push a single clean commit so the old blobs
     are never reachable —
     ```bash
     git checkout --orphan clean-main && git add -A && git commit -m "Source-only (build at deploy)"
     # join the repo's initial commit first (§3), then:
     git push keboola clean-main:main
     ```
   - **History must be preserved:** purge the blob with `git filter-repo` (or BFG), then push.

If a push still 413s, re-run **both** guards (working tree *and* history) and **report the
offending file** — the user must decide how to externalize it (it can't be split).

## 5. Deploy + verify

```bash
kbagent --json tool call deploy_data_app --project <alias> \
  --input '{"action":"deploy","configuration_id":"<cfg>"}'
```
**Verify from the logs — they are the authoritative signal** (build is ~90s+ for `npm ci` + `next build`; `setup_sh` can take ~2min total):
```bash
kbagent --allow-env-manage-token data-app logs --project <alias> --app-id <data_app_id> --lines 300
```
Look for, in order: `✓ Compiled successfully` and `Generating static pages` (the `next build`
finished), `Completed: setup_sh` (the static-asset `cp` succeeded — under `set -e` a wrong
copy path would abort here), then `success: node-frontend entered RUNNING state` and
`✓ Ready in …ms` (the standalone server is up on :3000). The python service shows
`success: python-api entered RUNNING state`. If a deeper window is dominated by one service's
restart loop, raise `--lines` to see the other service's earlier startup.

**Do NOT rely on an HTTP probe to confirm the frontend.** An unauthenticated `GET /` returns
the **Keboola platform login gate** (HTTP 200, `<title>Login</title>`, no `_next/static`
references) — that's the platform auth proxy *in front of* the container, not your app. And
`POST /` returns 200 from the nginx `location = /` health rule regardless of app state. Real
proof that the built frontend serves is `node-frontend entered RUNNING` + `Ready in` in the
logs (optionally: authenticate with the app password, then check the HTML references
`/_next/static/…`).

Get the app password / set secrets + redeploy as needed:
```bash
kbagent --json --allow-env-manage-token data-app password --project <alias> --app-id <data_app_id>
kbagent --allow-env-manage-token data-app secrets-set --project <alias> --app-id <data_app_id> '#KEY=VAL'
```

**Success = repo in Keboola git + app deploys + container builds + `node-frontend` RUNNING + backend process starts.** Backend *data* errors — e.g. `python-api` crash-looping on a Storage `404 Not Found` from its startup data load — mean the app is running and looking for tables that don't exist in an empty project. That's a data condition, **not** a git/deploy failure.

## Gotchas

Full command catalog, the 413/build-at-deploy recipe, and the gotchas table live in
[`references/managed-git.md`](references/managed-git.md).
