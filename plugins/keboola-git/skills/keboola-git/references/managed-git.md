# Keboola-Managed Git — Reference

Full `kbagent` command catalog, the HTTP 413 / build-at-deploy recipe, and the gotchas
table for accessing Keboola-managed Forgejo repos for python-js data apps.

All commands assume:
```bash
export KBAGENT_CONVERSATION_ID=$(uuidgen)   # once per shell session
# <alias>  = the kbagent project alias (e.g. e2e-1143)
# <id>     = app_id of the data app
```
Pass `--json` when you parse the output. It is under `.data`.

---

## kbagent command catalog

### Provision / find the repo

```bash
# List existing data apps (find app_id)
kbagent --json data-app list --project <alias>

# Drafts are listed too: a draft's git-repo shows is_managed_git_repo: false and the URL
# of its prod app's repo. The prod app on a managed repo shows true.

# Create an app + its managed repo -- ONLY when the project has no python-js app on a managed repo.
# It does not deploy: the repo has no app code yet.
kbagent --json data-app create --project <alias> --name "<Display Name>" --slug <slug> \
  --description "<desc>" --type python-js --use-managed-git-repo

# The repo's clone URL (https://git.<stack>/keboola/app-<id>.git)
kbagent --json data-app git-repo --project <alias> --app-id <id>
```
**Returns:** `create` -> `app_id`; `git-repo` -> `https_url`, `ssh_url`, `is_managed_git_repo`.

Prod-and-drafts model: the **prod** app owns the only repo, and each draft runs one branch
of it. There is not a separate repo per draft. kbagent has no draft command, and every
`data-app create` **creates an app and a repo**. The repo can never be attached to an
existing app afterwards. When your context already names the app (the page you were opened
on, an id in the request) use it directly; otherwise check `data-app list` first. Full rules:
`plugins/dataapp-developer/skills/dataapp-development/references/python-js-prod-and-drafts.md`.

### Mint a push credential (one-time secret)

```bash
TOKEN=$(kbagent --json data-app git-credentials-create --project <alias> --app-id <id> \
  --type http_token --permissions readWrite --name push --yes | jq -r '.data.credential.secret')
HTTPS_URL=$(kbagent --json data-app git-repo --project <alias> --app-id <id> | jq -r '.data.https_url')
URL="https://kai:${TOKEN}@${HTTPS_URL#https://}"
```

- Needs an **admin** Storage token (403 otherwise). A non-managed repo (`--git-repo <url>`) gets 409.
- Secret is shown **once**. Mint a fresh credential anytime; `data-app git-credentials` lists them without secrets.
- Hold it in a shell variable only — never commit, echo to a file, or log it.

### Deploy

```bash
kbagent data-app deploy --project <alias> --app-id <id> --git-branch main --wait
```
`--git-branch main` matters only while the app has no git block in its configuration (its first deploy).

### Logs / password / secrets

```bash
# Build + runtime logs (~90s build for npm ci + next build)
kbagent data-app logs --project <alias> --app-id <id> --lines 200

# App password (for authenticated probes) -- copies it, never prints it
kbagent data-app password --project <alias> --app-id <id> --copy

# Set an env secret, then redeploy
kbagent data-app secrets-set --project <alias> --app-id <id> --secret '#KEY=VAL'

# Delete the app (teardown — confirm first)
kbagent data-app delete --project <alias> --app-id <id>
```

---

## Raw-git clone / push pattern

kbagent has **no repo-copy helper**. Drive git yourself from a scratch dir under CWD:

```bash
mkdir -p ./.keboola-git-work && cd ./.keboola-git-work
git clone --single-branch --branch <branch> <source-repo> app && cd app

# $URL from "Mint a push credential" above
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

Never force-push to skip the join: `main` is the prod branch.

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
     `git checkout --orphan clean-main && git add -A && git commit -m "Source-only"`, then run the
     join step from the clone / push pattern above and `git push keboola clean-main:main`.
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
| First push to `main` rejected (`fetch first` / non-fast-forward) | A new app's repo starts with one initial commit on `main`, which your history does not contain | Run the join step from the clone / push pattern, then push again. Never force-push |
| `git push keboola :main` fails | The repo refuses deleting its default branch | Expected: `main` is the default branch and stays. Any other branch deletes normally (`git push keboola --delete <branch>`) |
| Force-push to a shared branch | Not blocked by the server — it overwrites others' commits | Never force-push managed/shared branches |
| Credential leaked into a commit or log | `$URL` or the token echoed to a file | Rotate immediately (mint a new credential), scrub history; keep the URL in a shell var only |
| `git-credentials-create` returns 403 | The project's token is not an admin Storage token | Register the project with an admin token |
| Deploy succeeds but `python-api` crash-loops on `404 Not Found` at startup | Backend's startup data load hits Storage tables that don't exist in an empty project | **Expected** out-of-scope data error — the app is running and looking for data; not a git/deploy failure. Verify the *frontend* separately (`node-frontend` RUNNING). |
| `GET /` returns a login page (`<title>Login</title>`, no `_next/static`) | Keboola platform auth gate sits *in front of* the container — it returns 200 regardless of app state | Not a frontend signal. Confirm serving via logs (`node-frontend entered RUNNING`, `Ready in`); to test the app UI, authenticate with the app password first |
| `POST /` returns 200 but app may not be up | nginx `location = /` returns 200 for POST unconditionally (platform health rule) | Don't use POST `/` as a serving check; rely on `node-frontend entered RUNNING` in the logs |
| Frontend genuinely not serving | `next build` failed, static `cp` path wrong, or server crashed | Check logs for `Compiled successfully`, `Completed: setup_sh`, and `node-frontend` spawn/RUNNING vs `exited`/`backoff` |
