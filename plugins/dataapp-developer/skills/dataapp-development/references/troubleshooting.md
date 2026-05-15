# Troubleshooting

**Use this when:** the app is failing to start, returning errors, or behaving unexpectedly.

## "Cannot POST /" / "Method Not Allowed" on startup

**Symptom:** App appears broken on first deploy. Logs show "Method Not Allowed" or "Cannot POST /".

**Cause:** Root route only accepts GET. Keboola POSTs to `/` on startup to verify the app is alive.

**Fix:**

- Flask: `@app.route("/", methods=["GET", "POST"])`
- Express: `app.all('/', ...)` (NOT `app.get('/', ...)`)
- Streamlit: handles natively — no fix needed.

```python
from flask import Flask

app = Flask(__name__)

@app.route("/", methods=["GET", "POST"])
def root():
    return {"status": "ok"}
```

```javascript
const express = require('express');
const app = express();

app.all('/', (req, res) => {
  res.json({ status: 'ok' });
});
```

## "externally-managed-environment" / PEP 668

**Symptom:** `setup.sh` fails with "error: externally-managed-environment" or "this environment is externally managed".

**Cause:** Code in `setup.sh` or the app uses `pip install`. The base image blocks bare `pip` (PEP 668).

**Fix:**

- Replace `pip install -r requirements.txt` with `uv sync` in `setup.sh`.
- Ensure a `pyproject.toml` exists at `/app` with dependencies listed in `[project.dependencies]`.
- All Python commands in `supervisord/services/*.conf` must be prefixed with `uv run` (e.g. `uv run uvicorn ...`).

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /app
uv sync
```

## WebSocket fails / Streamlit blank page

**Symptom:** Streamlit app loads but stays blank. Browser console shows WebSocket connection failures to `/_stcore/stream`.

**Cause:** Nginx not configured to upgrade WebSocket connections.

**Fix:** Add to `keboola-config/nginx/sites/default.conf` inside the `location /` block:

```nginx
location / {
    proxy_pass http://127.0.0.1:8050;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

## Streaming responses arrive all at once

**Symptom:** Server-Sent Events (SSE) or long-running responses display only at the end, not progressively. Real-time chat appears frozen until the full response arrives.

**Cause:** Nginx buffers the entire upstream response before forwarding.

**Fix:** Add to the relevant nginx location block:

```nginx
proxy_buffering off;
proxy_cache off;
proxy_request_buffering off;
```

For Kai chat (`/api/chat`), put these in a dedicated location block that proxies to the chat endpoint:

```nginx
location /api/chat {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_request_buffering off;
    proxy_read_timeout 86400;
}
```

## App won't start / restart loop

**Symptom:** Container starts but the app process keeps restarting; Supervisord logs show repeated process spawns.

**Causes (any of):**

- Relative paths in `supervisord/services/*.conf` (e.g. `command=python app.py`).
- Missing `uv run` prefix for Python commands.
- Non-executable `setup.sh` (missing `chmod +x`).
- `[program:nginx]` declared in your supervisord config — the base image already manages nginx.

**Fix:**

- Absolute `/app/...` paths everywhere.
- All Python commands: `command=uv run python /app/app.py`.
- `chmod +x keboola-config/setup.sh` and commit the executable bit.
- Remove any `[program:nginx]` block — the base image owns that.

```bash
chmod +x keboola-config/setup.sh
git update-index --chmod=+x keboola-config/setup.sh
git add keboola-config/setup.sh
git commit -m "fix: make setup.sh executable"
```

## Port mismatch local vs Keboola

**Symptom:** App works locally but Keboola shows a blank page or proxy error.

**Cause:** The port in `nginx/sites/default.conf` `proxy_pass` doesn't match the port the app listens on (or the `--port` flag in the supervisord command).

**Fix:** Make them match. Common conventions:

- Flask: `5000`
- FastAPI / Streamlit: `8050`
- Streamlit when local default: `8501` (production usually `8050`)
- Node / Express: `3000`

The `--server.port 8050` flag in the Streamlit supervisord command overrides Streamlit's default 8501 — nginx must proxy to whatever port you set.

## Exit code 153

**Symptom:** Deploy fails with container exit code 153.

**Cause:** Git commit locking — the locked commit no longer exists in the remote (force-push, history rewrite, branch deletion).

**Fix:** Either restore the missing commit (`git push <sha>`), or trigger a fresh deploy that re-locks to current HEAD. From kbagent:

```bash
kbagent data-app deploy --project P --app-id N --wait
```

## Workspace ID has "WORKSPACE_<id>" prefix

**Symptom:** Calls to `/v2/storage/branch/.../workspaces/<id>/query` return 404. The workspace ID in the env var looks like `WORKSPACE_12345` (Snowflake schema name).

**Cause:** Keboola sometimes exposes the Snowflake schema name as the workspace ID. The Storage API expects the numeric ID only.

**Fix:** Strip the prefix in your env-resolution code:

```javascript
function normalizeWorkspaceId(raw) {
  if (!raw) return null;
  const m = raw.match(/^WORKSPACE_(\d+)$/i);
  return m ? m[1] : raw;
}
```

```python
import re

def normalize_workspace_id(raw: str) -> str | None:
    if not raw:
        return None
    m = re.match(r'^WORKSPACE_(\d+)$', raw, re.IGNORECASE)
    return m.group(1) if m else raw
```

## 500 from missing env var

**Symptom:** API endpoints return 500. Application logs show `KeyError` for an env var or `process.env.X` is undefined.

**Cause:** The required secret is not configured in `dataApp.secrets`.

**Fix:** Add the secret to the app configuration:

- UI: Configuration → Secrets → add `#KEY=value`.
- MCP: pass it in `modify_data_app` source code's expected env vars list, OR use the Configuration API directly.
- kbagent:

  ```bash
  kbagent data-app secrets-set --app-id N --secret '#KEY=value'
  kbagent data-app deploy --wait
  ```

Remember: secret names get `#`-prefix stripped, dashes→underscores, uppercased. `#my-key` → env var `MY_KEY`.

## Reading logs

Three options for reading logs from a deployed data app:

- **MCP `mcp__keboola__get_data_apps(configuration_ids=[cfg_id])`** — returns the latest 20 log lines via `deployment_info.logs`. This is the preferred path from an agent / Claude Code session: no UI navigation, the lines come back in the response. Pair with redeploy via `mcp__keboola__deploy_data_app` for a full edit → deploy → inspect-logs debug loop.
- **Keboola UI Terminal Log tab** — near-real-time view of container `stdout`/`stderr`. Available while the app is running. "Download Logs" button gives the full log file. Logs are deleted when the app stops. Use this when the MCP tail isn't enough or you need to grep across the full session.
- **kbagent CLI** — a dedicated `data-app logs` command is a follow-up. For now, fall through to the Terminal Log UI link surfaced in `data-app deploy --wait` error output.

### Streamlit-specific footgun: silent exceptions

Streamlit catches uncaught exceptions and renders them in the UI, but **does NOT propagate them to `stdout`/`stderr` by default**. The MCP `get_data_apps` log tail and the Terminal Log tab will show NOTHING for an error that's clearly visible to the user in their browser. If your remote debugging session looks "clean" but the app is obviously broken, this is the cause.

Fix: wrap `main()` in a logging decorator that catches, logs to `stderr`, then re-raises so Streamlit still shows the error in the UI. See [streamlit-apps.md](streamlit-apps.md) §Capturing errors for platform logs for the pattern.

Python/JS apps (Flask, FastAPI, Express) don't have this issue — their frameworks log uncaught exceptions to `stderr` automatically and supervisord forwards them.
