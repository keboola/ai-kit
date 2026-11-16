# Deploy

**Use this when:** you need to push the scaffolded app to git and deploy it as a Keboola data app.

> An MCP data app is a **Python/JS** app: it deploys from **git**, not via the Streamlit `deploy_data_app`/`modify_streamlit_data_app` code path. Detect available drivers at session start and **pick one — don't mix** (see `dataapp-development/references/deployment-paths.md`).

## Pick a driver

| You have… | Driver | Mechanics live in |
|---|---|---|
| `kbagent` on PATH | kbagent CLI / keboola-git managed repo | `keboola-git` skill; `deployment-paths.md` Path C |
| Hosted Keboola MCP tools (Kai, or Claude + hosted MCP) | MCP data-app tools | this file, §MCP-tools driver |
| Neither | Manual Keboola UI | this file, §Manual UI |

Where the source lives is a separate choice. The drivers below copy it into the app's **Keboola-managed repo**. If the user already keeps it in a private **GitHub repo**, deploy straight from that repo with organization auth instead: no copy and no PAT. See §Existing GitHub repo with organization auth.

## keboola-git / kbagent driver

Full command reference and repo-provisioning details live in the `keboola-git` skill (also see `deployment-paths.md` Path C). The minimal sequence:

This is a **prod/`main` sequence**: an MCP server app is deployed, not iterated on behind a
preview. If you do want to stage changes on a branch first, use the prod-app-and-drafts flow
in `plugins/dataapp-developer/skills/dataapp-development/references/python-js-prod-and-drafts.md` instead of this block.

```bash
# 1. Resolve the app. Creating one also creates a managed repo, and that repo can never be
#    attached to an existing app afterwards -- so look before you create.
kbagent --json data-app list --project <alias>
#    The list also shows drafts and apps on external repos. For each python-js app run
#    kbagent --json data-app git-repo --project <alias> --app-id <app_id>
#    The prod app on a managed repo has is_managed_git_repo: true. A draft has false and
#    the URL of its prod app's repo.
#    Exactly one such prod app -> take its app_id as <id> and skip step 2.

# 2. ONLY when the project has no python-js app at all: create the app and its repo.
#    --auth public: the app's own #MCP_API_KEY is the auth (see App-level auth below).
kbagent --json data-app create --project <alias> --name "MCP Data App" --slug mcp-data-app \
  --description "Hosted MCP server" --type python-js --use-managed-git-repo --auth public
#    -> data.app_id is <id>. The repo starts empty of app code, so create does not deploy.

# 3. Mint a push credential (needs an admin Storage token), push the source to main, deploy.
#    The secret is shown once: never print it. Run step 3 as ONE shell command: a new shell
#    has no $TOKEN. A failed kbagent call stops here and prints its error (no secret in it).
CRED=$(kbagent --json data-app git-credentials-create --project <alias> --app-id <id> \
  --type http_token --permissions readWrite --name push --yes)
TOKEN=$(jq -er '.data.credential.secret' <<<"$CRED") || { jq -c '.error' <<<"$CRED" >&2; exit 1; }
REPO=$(kbagent --json data-app git-repo --project <alias> --app-id <id>)
HTTPS_URL=$(jq -er '.data.https_url' <<<"$REPO") || { jq -c '.error' <<<"$REPO" >&2; exit 1; }
git remote add keboola "https://kai:${TOKEN}@${HTTPS_URL#https://}"
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
kbagent data-app deploy --project <alias> --app-id <id> --git-branch main --wait
```

Note: "push source only" — the app carries no build artifact, so the keboola-git 15 MB / HTTP 413 path does not apply.

## MCP-tools driver (Kai / hosted MCP)

The same steps as the kbagent driver, done with MCP tools:

- `modify_python_js_data_app(...)` → returns `configuration_id`, `data_app_id`, `repo_url`. With an empty `configuration_id` it **creates a new prod app and a new repo** every time. A draft of an existing app comes from `create_python_js_data_app_draft` instead. Full rules: `plugins/dataapp-developer/skills/dataapp-development/references/python-js-prod-and-drafts.md`.
- `create_python_js_data_app_git_credential(configuration_id)` → returns `git_clone_url` (contains a one-time secret; keep in a variable, never commit/echo).
- `git push` the scaffolded tree to that URL (a git-capable runner is still required).
- `deploy_data_app(action="deploy", configuration_id=...)`.

These tools are live today.

## Existing GitHub repo with organization auth

Use this when the scaffolded server is already pushed to a GitHub repo (`github.com`, or a `*.ghe.com` host the stack is configured for; a GHE Server host on its own domain works through kbagent only). The platform reads it through the Keboola organization's GitHub App connection, so nothing is copied into Keboola git and no PAT is stored.

Prerequisites: the Keboola GitHub App installed on the GitHub organization and that organization connected to the Keboola organization, both done by someone who is a Keboola organization admin and an owner of the GitHub organization ([how](https://help.keboola.com/management/organization/#connect-github)). The URL must be `https://`. An MCP server app is deployed rather than iterated on behind a preview, so deploy prod directly.

MCP tools:

```python
modify_python_js_data_app(
    name="MCP Data App", description="Hosted MCP server",
    configuration_id="",            # create; resolve an existing app first (same rule as above)
    git_repository="https://github.com/<org>/<repo>",
    git_auth="organization",
    branch="main",
)
deploy_data_app(action="deploy", configuration_id="<cfg>")   # prod mode; mode='dev' is refused
```

kbagent:

```bash
kbagent data-app create --project <alias> --name "MCP Data App" --slug mcp-data-app \
  --git-repo https://github.com/<org>/<repo> --git-auth organization --git-branch main --type python-js --wait
# create deploys the app; run `data-app deploy --wait` only for later redeploys
```

An existing MCP app on a Keboola-managed repo can't be rebound to the GitHub repo. A new app is a second one, so it needs the user's yes. Confirm the organization connection first: a missing one only fails at deploy. On the MCP path the app already exists by then and has to be deleted; kbagent `create --wait` deletes it itself unless `--keep-on-failure` is passed.

To redeploy after a change, push to that GitHub branch and deploy again. `create_python_js_data_app_git_credential` doesn't apply: the app has no managed repo. Errors and limits: `plugins/dataapp-developer/skills/dataapp-development/references/github-organization-auth.md`. Then continue with Secrets and App-level auth below.

## Manual UI

1. Apps → Create App → Python/JS Data App.
2. Point it at the repo URL and branch containing the scaffolded app.
3. Add the three secrets (see Secrets below).
4. Set App-level auth to **No auth** (see App-level auth = None (critical) below).
5. Set auto-suspend to ≥ 24h.
6. Deploy.

## Secrets

| Secret | Required | Notes |
|---|---|---|
| `#KBC_STORAGE_API_URL` | Yes | Your Keboola stack, e.g. `https://connection.us-east4.gcp.keboola.com` |
| `#KBC_STORAGE_TOKEN` | Yes | Storage API token scoping this app to a project |
| `#MCP_API_KEY` | Yes | Generate with `openssl rand -hex 32` |
| `#MCP_PUBLIC_URL` | No | Override only. See The app's own URL below |
| `#KBC_WORKSPACE_ID` | No | Override only. With Storage Access enabled, `server.py` already pins tool calls to this app's own workspace from the injected `WORKSPACE_ID` at startup (each redeploy creates a new workspace, so never copy its ID into a secret). Set this only for a stable workspace you manage yourself |

Via kbagent: `kbagent data-app secrets-set --project <alias> --app-id <id> --secret '#KEY=VAL'` then redeploy.

## App-level auth = None (critical)

Set the data app's built-in authentication to **None**. Keboola's app-level OIDC strips the `Authorization` header before it reaches the container, breaking both the bearer and OAuth-shape flows. `#MCP_API_KEY` is the security boundary. See `dataapp-development/references/authentication.md` (the "None — implement your own auth in code" option).

## The app's own URL

The OAuth-shape discovery docs must advertise the app's own origin. Keboola injects `KBC_APP_PUBLIC_URL` into every data-app container with exactly that value (`https://<slug>-<appId>.hub.<region>.keboola.com`), and `server.py` reads it. **No secret, and no second deploy pass, is needed.**

`#MCP_PUBLIC_URL` is an override for the case where the app is reached at some other origin (custom domain, reverse proxy). It wins over the platform value, which has one consequence worth knowing: **config duplication copies all secrets verbatim, so a copy of an app that sets the override keeps advertising the source app's origin.** The copy deploys and runs fine and only a fresh client's OAuth handshake breaks. Remove `#MCP_PUBLIC_URL` from the copy — don't reset it to the new URL — so it falls back to the platform value and stays correct through any future duplication.

## Verify

Logs first (authoritative): look for `success: mcp-server entered RUNNING state` in the deploy logs (via `kbagent … data-app logs` or the Keboola Terminal Log tab). Then:

```bash
curl -sS https://<app-url>/healthz
curl -sS https://<app-url>/.well-known/oauth-protected-resource
curl -sS -i https://<app-url>/mcp | head -5   # expect 401 + WWW-Authenticate
```

The discovery JSON must show this app's own URL. Another app's URL means an `#MCP_PUBLIC_URL` override was carried over by config duplication — remove it and redeploy. `127.0.0.1:5000` means neither the override nor `KBC_APP_PUBLIC_URL` was present, which on Keboola should not happen.
