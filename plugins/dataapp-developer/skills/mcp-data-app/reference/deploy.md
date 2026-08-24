# Deploy

**Use this when:** you need to push the scaffolded app to git and deploy it as a Keboola data app.

> An MCP data app is a **Python/JS** app: it deploys from **git**, not via the Streamlit `deploy_data_app`/`modify_streamlit_data_app` code path. Detect available drivers at session start and **pick one — don't mix** (see `dataapp-development/references/deployment-paths.md`).

## Pick a driver

| You have… | Driver | Mechanics live in |
|---|---|---|
| `kbagent` on PATH | kbagent CLI / keboola-git managed repo | `keboola-git` skill; `deployment-paths.md` Path C |
| Hosted Keboola MCP tools (Kai, or Claude + hosted MCP) | MCP data-app tools | this file, §MCP-tools driver |
| Neither | Manual Keboola UI | this file, §Manual UI |

## keboola-git / kbagent driver

Full command reference and repo-provisioning details live in the `keboola-git` skill (also see `deployment-paths.md` Path C). The minimal sequence:

```bash
# provision (or find) the managed repo, mint a push credential, push source, deploy
kbagent --json tool call modify_python_js_data_app --project <alias> \
  --input '{"name":"MCP Data App","slug":"mcp-data-app","description":"Hosted MCP server"}'
kbagent --json tool call create_python_js_data_app_git_credential --project <alias> \
  --input '{"configuration_id":"<cfg>"}'
# -> git_clone_url = https://kai:<secret>@git.<stack>/keboola/app-<id>.git  (keep in a var)
git remote add keboola "$URL" && git push keboola HEAD:main
kbagent --json tool call deploy_data_app --project <alias> \
  --input '{"action":"deploy","configuration_id":"<cfg>"}'
```

Note: "push source only" — the app carries no build artifact, so the keboola-git 15 MB / HTTP 413 path does not apply.

## MCP-tools driver (Kai / hosted MCP)

Same three tools as the kbagent driver, called directly as MCP tools rather than via `kbagent … tool call`:

- `modify_python_js_data_app(name, slug, description)` → returns `configuration_id`, `data_app_id`, `repo_url`.
- `create_python_js_data_app_git_credential(configuration_id)` → returns `git_clone_url` (contains a one-time secret; keep in a variable, never commit/echo).
- `git push` the scaffolded tree to that URL (a git-capable runner is still required).
- `deploy_data_app(action="deploy", configuration_id=...)`.

`deployment-paths.md` still calls this a placeholder; the tools are live today. Treat this path as real.

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
| `#KBC_WORKSPACE_ID` | No | Pin tool calls to a specific workspace (e.g. this app's own `WORKSPACE_ID`) instead of the default per-branch one |

Via kbagent: `kbagent --allow-env-manage-token data-app secrets-set --project <alias> --app-id <id> '#KEY=VAL'` then redeploy.

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
