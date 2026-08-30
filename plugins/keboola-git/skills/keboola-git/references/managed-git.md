# Keboola-Managed Git — Reference

Full `kbagent` command catalog, the HTTP 413 / build-at-deploy recipe, and the gotchas
table for accessing Keboola-managed Forgejo repos for python-js data apps.

All commands assume:
```bash
export KBAGENT_CONVERSATION_ID=$(uuidgen)   # once per shell session
# <alias>  = the kbagent project alias (e.g. e2e-1143)
# <cfg>    = configuration_id of the prod data-app config
# <id>     = data_app_id
```
Always pass `--json` to `tool call` so output is parseable.

---

## kbagent command catalog

### Provision / find the repo

```bash
# List existing data apps (find configuration_id, data_app_id, repo_url)
kbagent --json tool call get_data_apps --project <alias> --input '{}'

# Provision a new python-js data app (creates the managed repo)
kbagent --json tool call modify_python_js_data_app --project <alias> \
  --input '{"name":"<Display Name>","slug":"<slug>","description":"<desc>"}'
```
**Returns:** `configuration_id`, `data_app_id`, `repo_url`
(`https://git.<stack>/keboola/app-<data_app_id>.git`).

Two-app model: the **prod** config owns the only repo. Draft branches are advanced from
prod; there is not a separate repo per draft.

### Mint a push credential (one-time secret)

```bash
kbagent --json tool call create_python_js_data_app_git_credential --project <alias> \
  --input '{"configuration_id":"<cfg>"}'
```
**Returns:** `git_clone_url` = `https://kai:<secret>@git.<stack>/keboola/app-<id>.git`.

- Secret is shown **once**. Mint a fresh credential anytime; rotation invalidates old ones.
- Hold it in a shell variable only — never commit, echo to a file, or log it.

### Deploy

```bash
kbagent --json tool call deploy_data_app --project <alias> \
  --input '{"action":"deploy","configuration_id":"<cfg>"}'
```

### Logs / password / secrets (need a manage token in env)

```bash
# Build + runtime logs (~90s build for npm ci + next build)
kbagent --allow-env-manage-token data-app logs --project <alias> --app-id <id> --lines 200

# App password (for authenticated probes)
kbagent --json --allow-env-manage-token data-app password --project <alias> --app-id <id>

# Set an env secret, then redeploy
kbagent --allow-env-manage-token data-app secrets-set --project <alias> --app-id <id> '#KEY=VAL'

# Delete the app (teardown — confirm first)
kbagent --json --allow-env-manage-token data-app delete --project <alias> --app-id <id>
```

---

## Raw-git clone / push pattern

kbagent has **no repo-copy helper**. Drive git yourself from a scratch dir under CWD:

```bash
mkdir -p ./.keboola-git-work && cd ./.keboola-git-work
git clone --single-branch --branch <branch> <source-repo> app && cd app

URL='https://kai:<secret>@git.<stack>/keboola/app-<id>.git'   # from step "mint credential"
git remote add keboola "$URL"
git push keboola HEAD:main
```

Reverse direction (Keboola → GitHub scratch):
```bash
git clone --single-branch --branch main "$URL" app && cd app
git remote add github <scratch-repo-url>
git push github main:<scratch-branch>     # never a shared branch; never --force
```

---

## HTTP 413 / build-at-deploy recipe

Forgejo rejects pushes larger than **~15MB** with **HTTP 413 Payload Too Large**. A single
file over the cap **cannot be split** — it must not be tracked at all.

The headline offender: repos that **commit their build**. Example — a Next.js app committing
`frontend/.next/` (~55MB), which also bundles a 15.3MB macOS `sharp` native binary that is
both over-cap *and* the wrong architecture for the Linux deploy runtime.

**Fix — push source only, build in the container at deploy:**

1. **Size guard** (run before every push):
   ```bash
   find . -size +15M -not -path '*/.git/*'
   ```
2. **Untrack + gitignore the build:**
   ```bash
   git rm -r --cached frontend/.next
   printf '%s\n' 'frontend/.next/' 'node_modules/' >> .gitignore
   git add -A && git commit -m "Source-only: build at deploy"
   ```
3. **Move the build into `keboola-config/setup.sh`** (runs in the Linux container on startup):
   ```bash
   cd frontend && npm ci && npm run build
   # Next.js output:'standalone' does NOT copy static assets — copy them so the standalone
   # server.js can serve them. Destination MIRRORS the path from the Next.js workspace root,
   # so it differs by layout. Detect where the build put server.js:
   #   find .next/standalone -maxdepth 3 -name server.js
   # Single-package repo (root == frontend/, server.js at .next/standalone/server.js):
   cp -r .next/static .next/standalone/.next/static
   cp -r public       .next/standalone/public
   # Monorepo (root above frontend/, server.js at .next/standalone/frontend/server.js):
   #   cp -r .next/static .next/standalone/frontend/.next/static
   #   cp -r public       .next/standalone/frontend/public
   ```
   For the surrounding setup.sh / nginx / supervisord wiring, see the
   `dataapp-developer:dataapp-development` skill.
4. **Re-run the working-tree size guard** (must return nothing).
5. **Guard git *history*, not just the working tree.** `git push` sends every object reachable
   from the pushed ref, so a build committed in an *earlier* commit still 413s even after step 2.
   The `find` guard only sees the working tree. Check reachable blobs:
   ```bash
   git rev-list --objects HEAD \
     | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' \
     | awk '$1=="blob" && $2>15000000 {print $2, $3}'
   ```
   If anything prints, the over-cap blob is in history. Remedies:
   - **Fresh managed repo (common):** push one clean commit so old blobs aren't reachable —
     `git checkout --orphan clean-main && git add -A && git commit -m "Source-only" && git push keboola clean-main:main`.
   - **Preserve history:** purge the blob with `git filter-repo` (or BFG), then push.

If a push still returns 413, re-run **both** guards (working tree *and* history) and **report the
offending file by name** — the user decides how to externalize it (download at deploy, fetch from
object storage, etc.). You cannot split it.

---

## Gotchas table

| Symptom / situation | Cause | What to do |
|---|---|---|
| `HTTP 413` on push | A single tracked file (or total payload) > ~15MB | Source-only + build-at-deploy (above); report the offending file if a single file is over cap |
| `HTTP 413` even after untracking the build | Over-cap blob still in an **earlier commit** — `git push` sends all reachable history, the `find` guard only sees the working tree | Check `git rev-list --objects HEAD \| git cat-file --batch-check`; push an `--orphan` clean commit (fresh repo) or `git filter-repo`/BFG to purge (preserve history) |
| Static assets 404 after deploy / blank page | `cp` destination didn't match where `next build` put `server.js` | Destination mirrors the Next.js workspace root — `find .next/standalone -name server.js` and copy `static`/`public` alongside it |
| Committed `frontend/.next` ~55MB | Build artifacts checked into the repo | `git rm -r --cached`, gitignore, build in `setup.sh` |
| 15.3MB `sharp` binary | macOS-built native dep, wrong arch for Linux | Don't track it; `npm ci` in container reinstalls the correct Linux binary |
| `git push keboola :main` / delete fails | Pre-receive hook **declines branch deletes** | Branches only advance; never rely on deleting a remote branch |
| Force-push rejected / dangerous | Shared managed branch | Never force-push managed/shared branches |
| Credential leaked into a commit or log | `git_clone_url` echoed to a file | Rotate immediately (mint a new credential), scrub history; keep the URL in a shell var only |
| `logs` / `password` command errors on auth | Manage token not in env | Add `--allow-env-manage-token` and ensure the manage token is exported |
| Deploy succeeds but `python-api` crash-loops on `404 Not Found` at startup | Backend's startup data load hits Storage tables that don't exist in an empty project | **Expected** out-of-scope data error — the app is running and looking for data; not a git/deploy failure. Verify the *frontend* separately (`node-frontend` RUNNING). |
| `GET /` returns a login page (`<title>Login</title>`, no `_next/static`) | Keboola platform auth gate sits *in front of* the container — it returns 200 regardless of app state | Not a frontend signal. Confirm serving via logs (`node-frontend entered RUNNING`, `Ready in`); to test the app UI, authenticate with the app password first |
| `POST /` returns 200 but app may not be up | nginx `location = /` returns 200 for POST unconditionally (platform health rule) | Don't use POST `/` as a serving check; rely on `node-frontend entered RUNNING` in the logs |
| Frontend genuinely not serving | `next build` failed, static `cp` path wrong, or server crashed | Check logs for `Compiled successfully`, `Completed: setup_sh`, and `node-frontend` spawn/RUNNING vs `exited`/`backoff` |
| kbagent tool call hangs / no output | `KBAGENT_CONVERSATION_ID` unset or `--json` omitted | Export the conversation id; always pass `--json` |
