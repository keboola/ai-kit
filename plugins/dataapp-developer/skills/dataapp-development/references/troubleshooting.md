# Troubleshooting

**Use this when:** the app is failing to start, returning errors, or behaving unexpectedly. Each entry is symptom → cause → pointer to the canonical fix in the relevant reference.

## Contents
- "Cannot POST /" / "Method Not Allowed" on startup
- "externally-managed-environment" / PEP 668
- WebSocket fails / Streamlit blank page
- Streaming responses arrive all at once
- App won't start / restart loop
- Port mismatch local vs Keboola
- Exit code 153
- `workspace.workspaceNotFound` 404
- Workspace ID value has `WORKSPACE_<id>` prefix
- 500 from missing env var
- Missing Storage Access env var (`WORKSPACE_ID` / `BRANCH_ID`)
- Config change has no effect after redeploy
- Query Service auth error with narrow-scoped token
- `Insufficient privileges` on write
- Reading logs (incl. Streamlit silent exceptions)

## "Cannot POST /" / "Method Not Allowed" on startup

**Cause:** Root route only accepts GET. Keboola POSTs to `/` on startup.

**Fix:** Flask `methods=["GET","POST"]`, Express `app.all('/')`, Streamlit handles natively. See [python-js-apps.md](python-js-apps.md) §POST handling on /.

## "externally-managed-environment" / PEP 668

**Cause:** `setup.sh` calls `pip install`. The base image blocks bare `pip`.

**Fix:** Replace with `uv sync` and prefix supervisord commands with `uv run`. See [python-js-apps.md](python-js-apps.md) §Python dependencies.

## WebSocket fails / Streamlit blank page

**Cause:** Nginx not configured to upgrade WebSocket connections — page loads but never updates.

**Fix:** Add the WebSocket upgrade snippet to the `location /` block in `keboola-config/nginx/sites/default.conf`. See [python-js-apps.md](python-js-apps.md) §Nginx (WebSocket snippet).

## Streaming responses arrive all at once

**Cause:** Nginx buffers the entire upstream response before forwarding (SSE / long responses).

**Fix:** `proxy_buffering off; proxy_cache off; proxy_request_buffering off;` in the relevant location block. See [python-js-apps.md](python-js-apps.md) §Nginx (SSE snippet); for Kai chat specifically, [kai-integration.md](kai-integration.md) §Pattern B.

## App won't start / restart loop

**Cause:** Any of: relative paths in supervisord configs, missing `uv run` prefix for Python, non-executable `setup.sh`, `[program:nginx]` declared (the base image owns nginx).

**Fix:** Absolute `/app/...` paths, `command=uv run python /app/app.py`, `chmod +x keboola-config/setup.sh` (commit the executable bit), and remove any `[program:nginx]` block. See [python-js-apps.md](python-js-apps.md) §Supervisord.

## Port mismatch local vs Keboola

**Cause:** The port in `nginx/sites/default.conf` `proxy_pass` doesn't match the port the app listens on.

**Fix:** Make them match. Common conventions: Flask 5000, FastAPI/Streamlit (production) 8050, Node/Express 3000. Streamlit's `--server.port 8050` flag overrides its default 8501.

## Exit code 153

**Cause:** Git commit locking — the locked commit no longer exists in the remote (force-push, history rewrite, branch deletion).

**Fix:** Restore the missing commit, or trigger a fresh deploy that re-locks to current HEAD: `kbagent data-app deploy --project P --app-id N --wait`. See [python-js-apps.md](python-js-apps.md) §Git commit locking.

## `workspace.workspaceNotFound` 404 from legacy workspace-query endpoint

**Cause:** Calling `{KBC_URL}/v2/storage/branch/<b>/workspaces/<w>/query` on a Snowflake project. That endpoint serves BigQuery workspaces, not Snowflake ones.

**Fix:** Switch to the Query Service via `keboola-query-service` (Python) / `@keboola/api-client`'s `queryService` client + SDK (JS) — the preferred path on both backends. See [storage-access.md](storage-access.md) §Direct RO workspace queries.

## Workspace ID value has `WORKSPACE_<id>` prefix

**Cause:** Keboola sometimes exposes the Snowflake schema name (`WORKSPACE_12345`) as the workspace ID. The Query Service expects the numeric ID only.

**Fix:** Strip the prefix with a regex (`^WORKSPACE_(\d+)$`) in your env-resolution code. The env var **name** is `WORKSPACE_ID`; this entry is about the **value** carrying a `WORKSPACE_` prefix.

## 500 from missing env var

**Cause:** Required secret not configured in `dataApp.secrets`.

**Fix:** Add the secret. UI: Configuration → Secrets → `#KEY=value`. kbagent: `kbagent data-app secrets-set --app-id N --secret '#KEY=value'` then `data-app deploy --wait`. Secret names get `#` stripped, dashes→underscores, uppercased: `#my-key` → env `MY_KEY`.

## `Missing env vars: WORKSPACE_ID` / `KeyError: 'BRANCH_ID'` (any Storage Access env var) on app start

**Cause:** the app configuration never asked for a workspace, so the platform provisioned none and injected nothing. Or, in local dev, `.env` / `.env.local` is missing the variable.

The app **still deploys, reports `state=running`, and passes its health probe** — it just cannot read data. This log line is the only signal.

**Fix:**
- **Production:** set `runtime.workspace.enabled=true` on the config, then redeploy **pinned to the new version** (a plain redeploy will not pick it up — see the next entry):
  ```bash
  kbagent config update --project P --component-id keboola.data-apps --config-id CFG --merge \
    --set 'runtime.workspace.enabled=true'
  VERSION=$(kbagent --json data-app detail --project P --app-id N \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['config_version_storage'])")
  kbagent data-app deploy --project P --app-id N --config-version "$VERSION" --wait
  ```
  UI equivalent: Advanced Settings → Storage Access. Apps created through MCP
  `modify_python_js_data_app` already have the flag. For read-only that flag is all you need;
  **writable** tables additionally require the project feature and an output mapping with
  `unload_strategy: "direct-grant"`. See [storage-access.md](storage-access.md) §Enabling Storage Access.
- **Local dev:** add the four variables to `.env` / `.env.local`. See [storage-access.md](storage-access.md) §Getting the env vars for local development.

## Config change has no effect after redeploy

**Cause:** the deployment is pinned to a Storage config version and a redeploy does not advance the pin, so the container renders the OLD config. Affects any `config.json` change — `git.branch`, `runtime.workspace.enabled`, secrets. A cold `stop` → `deploy` does **not** help, and no error is reported: the deploy says `state=running`.

**Diagnose:**
```bash
kbagent --json data-app detail --project P --app-id N | python3 -c "
import sys,json;d=json.load(sys.stdin)['data']
print(d['config_version_storage'], d['config_version_deployed'])"
```
Different numbers mean the app is serving a stale config.

**Fix:** deploy with an explicit pin. `--config-version` claims to default to latest; it does not.
```bash
kbagent data-app deploy --project P --app-id N --config-version <config_version_storage> --wait
```

## Query Service auth error with a narrow-scoped Storage API token

**Cause:** Token scoped to specific buckets / tables. Query Service evaluates access at the workspace level and rejects narrow-scoped tokens regardless of SQL.

**Fix:** Replace with a project-wide token (master token or a dedicated Full Access Storage API token). See [storage-access.md](storage-access.md) §`KBC_TOKEN`.

## `Insufficient privileges` / write blocked by the Query Service

**Cause:** Destination table not in `storage.output.tables` with `unload_strategy: "direct-grant"` (production), or the local workspace lacks write grants on the table (local dev).

**Fix:**
- **Production:** add the table to the data app config's output mapping with `direct-grant`; redeploy so the ephemeral workspace is re-provisioned.
- **Local dev:** create a dedicated workspace and grant write access on the same tables. See [storage-access.md](storage-access.md) §`WORKSPACE_ID`.
- Bucket stage (`in.` vs `out.`) isn't the issue — the workspace grant is.

## Reading logs

Three options:

- **MCP `mcp__keboola__get_data_apps(configuration_ids=[cfg_id])`** — latest 20 log lines via `deployment_info.logs`. Preferred from an agent / Claude Code session.
- **Keboola UI Terminal Log tab** — near-real-time `stdout`/`stderr`. "Download Logs" gives the full file. Logs are deleted when the app stops.
- **kbagent CLI** — `kbagent data-app logs --project P --app-id N --lines 200` tails the container logs, and is the most complete view outside the UI (the MCP tail is capped at 20 lines). Raise `--lines` when one service's restart loop drowns out another's startup. A **stopped** app returns `400 ... is not running` — start it first. Some subcommands (`password`, and depending on stack `logs`) need a Manage API token: run interactively, or pass `--allow-env-manage-token` with `KBC_MANAGE_API_TOKEN` set.

### Streamlit-specific footgun: silent exceptions

Streamlit catches uncaught exceptions and renders them in the UI but **does NOT propagate them to `stdout`/`stderr`** — log readers show nothing for an error clearly visible in the browser.

**Fix:** wrap `main()` in a logging decorator that catches, logs to `stderr`, then re-raises. See [streamlit-apps.md](streamlit-apps.md) §Capturing errors for platform logs.

Python/JS apps (Flask, FastAPI, Express) don't have this issue — their frameworks log uncaught exceptions to `stderr` automatically and supervisord forwards them.
