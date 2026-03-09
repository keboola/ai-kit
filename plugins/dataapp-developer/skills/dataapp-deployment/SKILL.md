---
name: dataapp-deployment
description: Use when deploying any web app to Keboola Data Apps, setting up keboola-config directory, configuring Nginx/Supervisord for Docker, handling SSE or WebSocket streaming through Nginx, mapping secrets to environment variables, or debugging Keboola Data App deployment issues like POST to root errors, 500s from missing env vars, or buffered streams.
---

# Deploying Web Apps to Keboola Data Apps

Guide for deploying web apps (Node.js, Python, or any language) to Keboola Data Apps using the `keboola/data-app-python-js` Docker base image.

## Architecture

Keboola Data Apps run in Docker containers:

```
Internet → Keboola proxy → Docker container
                              ├── Nginx (port 8888, public-facing)
                              │     └── reverse proxy → localhost:<app-port>
                              ├── Supervisord (process manager)
                              │     └── manages your app process(es)
                              └── Your app (any internal port)
```

**Key facts:**
- Base image: `keboola/data-app-python-js` (Debian Bookworm slim with Python, Node.js, Nginx, Supervisord)
- Nginx listens on **port 8888** (required, hardcoded by platform). Only ports ≥1024 are supported.
- Your app runs on any internal port (convention: 8050 for Streamlit/Dash, 3000 for Node.js, 5000 for Flask)
- App code is cloned from Git to `/app/`
- `keboola-config/setup.sh` runs on container startup before your app
- Secrets from `dataApp.secrets` are exported as env vars
- **Keboola platform sends a POST to `/` on startup** — your app must handle this (not just GET)

## Entrypoint Flow

The container startup sequence is:

1. **Input Mapping** — Wait for Data Loader (if configured)
2. **Git Clone** — Clone your repo into `/app/`
3. **Secrets Export** — Export `dataApp.secrets` as environment variables
4. **UV Config** — Configure private PyPI if `pip_repositories` is set
5. **Nginx Validation** — Require at least one `.conf` in `keboola-config/nginx/sites/`
6. **Supervisord Validation** — Require at least one `.conf` in `keboola-config/supervisord/`
7. **setup.sh** — Run `/app/keboola-config/setup.sh` (install deps)
8. **Start** — Run Supervisord (or `run.sh` if it exists)

## Python Dependency Management — CRITICAL

**The base image uses `uv` to manage Python. Bare `pip` is blocked (PEP 668).**

These will ALL fail:
```bash
# WRONG — PEP 668 blocks this
pip install -r requirements.txt

# WRONG — no virtual environment found
uv pip install -r requirements.txt

# WRONG — still fails in this environment
uv pip install --system -r requirements.txt
```

**The correct approach:**
```bash
# CORRECT — uses pyproject.toml, creates venv, installs everything
cd /app && uv sync
```

This means your Python app **must have a `pyproject.toml`** with dependencies listed in the `[project.dependencies]` array. A `requirements.txt` alone is not sufficient.

Similarly, all Python commands in Supervisord **must be prefixed with `uv run`** to execute within the uv-managed environment.

## Required Directory Structure

```
your-repo/
├── keboola-config/
│   ├── nginx/
│   │   └── sites/
│   │       └── default.conf        # Nginx reverse proxy config
│   ├── supervisord/
│   │   └── services/
│   │       └── app.conf            # Process manager config
│   └── setup.sh                    # Startup script (install deps)
├── pyproject.toml                  # Python deps (required for Python apps)
├── <your app files>                # Any language/framework
└── <dependency file>               # package.json for Node.js, etc.
```

## keboola-config Files

### nginx/sites/default.conf

Basic reverse proxy (works for any backend):

```nginx
server {
    listen 8888;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Change `8050` to whatever port your app listens on.

**For WebSocket apps (Streamlit, etc.)**, add upgrade headers:

```nginx
server {
    listen 8888;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

**For streaming endpoints (SSE, long-polling)**, add a separate location block with buffering disabled:

```nginx
    location /api/stream {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_request_buffering off;
        client_max_body_size 5m;
        proxy_read_timeout 120s;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
    }
```

Without `proxy_buffering off`, Nginx buffers the entire response before forwarding — the client sees nothing until the stream ends.

### supervisord/services/app.conf

> **Important:** Nginx is managed by the base image automatically — do NOT add `[program:nginx]` in your configs. Only define your own app processes.

**Python (Streamlit):**
```ini
[program:app]
command=uv run streamlit run /app/streamlit_app.py --server.port 8050 --server.headless true
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

**Python (Flask/FastAPI with uvicorn):**
```ini
[program:app]
command=uv run uvicorn app:app --host 127.0.0.1 --port 8050
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

**Python (Gunicorn):**
```ini
[program:app]
command=uv run gunicorn --bind 0.0.0.0:5000 app:app
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

**Node.js:**
```ini
[program:app]
command=node /app/server.js
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

Use absolute paths (`/app/...`). Relative paths cause startup failures.

### setup.sh

**Python apps:**
```bash
#!/bin/bash
set -Eeuo pipefail
cd /app && uv sync
```

**Node.js apps:**
```bash
#!/bin/bash
set -Eeuo pipefail
cd /app && npm install
```

**Multi-server (Python + Node.js):**
```bash
#!/bin/bash
set -Eeuo pipefail

cd /app && uv sync &
cd /app/frontend && npm install &
wait
```

Must be executable (`chmod +x`). Runs once on container startup before Supervisord starts your app.

## pyproject.toml (Required for Python Apps)

Python apps must define dependencies in `pyproject.toml`, not just `requirements.txt`:

```toml
[project]
name = "my-data-app"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "streamlit~=1.45.1",
    "pandas~=2.2.3",
    "plotly~=6.0.1",
    "requests>=2.31.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

If migrating from `requirements.txt`, move all dependencies into the `dependencies` array with their version specifiers.

## Environment Variables / Secrets

Keboola `dataApp.secrets` entries are exported as environment variables:
1. Leading `#` is stripped (Keboola secret marker)
2. Names are uppercased
3. Dashes and spaces become `_`
4. Invalid characters are removed
5. Non-string values (objects, arrays, numbers) are serialized as JSON strings

| dataApp.secrets key | Env var in container |
|---|---|
| `#KBC_TOKEN` | `KBC_TOKEN` |
| `#KBC_URL` | `KBC_URL` |
| `#KBC_DATABASE_NAME` | `KBC_DATABASE_NAME` |
| `#ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` |
| `#my-custom-var` | `MY_CUSTOM_VAR` |

Access them in your code as normal environment variables:

```python
import os
token = os.environ.get("KBC_TOKEN")
```

```javascript
const token = process.env.KBC_TOKEN;
```

**If your app already reads env vars locally, it works in Keboola with no code changes** — just add the matching secrets in the data app configuration.

Secrets are available to both `setup.sh` and the application runtime.

## Language-Specific Patterns

### Python with Streamlit

Streamlit is the simplest to deploy — it handles POST to `/` natively and needs minimal config.

**Nginx:** Must include WebSocket upgrade headers (see above). Streamlit uses WebSockets for `/_stcore/stream`.

**Supervisord:**
```ini
command=uv run streamlit run /app/streamlit_app.py --server.port 8050 --server.headless true
```

**setup.sh:**
```bash
cd /app && uv sync
```

### Python with Flask

```python
from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder="static")
PORT = int(os.environ.get("PORT", 5000))

@app.route("/api/data", methods=["GET", "POST"])
def data():
    return {"status": "ok"}

@app.route("/", methods=["GET", "POST"])  # Handle POST too
def index():
    return send_from_directory(".", "index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
```

### Node.js with Express

```javascript
import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API routes
import myHandler from './api/my-route.js';
app.all('/api/my-route', myHandler);

// Serve frontend — use app.all(), NOT app.get()
// Keboola POSTs to / on startup
app.all('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.use(express.static(__dirname, { index: false }));

app.listen(PORT, '0.0.0.0');
```

**Vercel dual-deployment tip:** Vercel serverless handlers (`export default function(req, res)`) are directly compatible with Express route handlers. Create an Express `server.js` that imports and mounts the same handler files — no code changes to the handlers themselves.

## Common Errors and Solutions

### "externally-managed-environment" / PEP 668

**Cause:** Using `pip install` directly. The base image manages Python via `uv`.
**Fix:** Use `uv sync` in setup.sh and prefix all Python commands with `uv run` in Supervisord. Ensure your project has a `pyproject.toml` with dependencies listed.

### "No virtual environment found"

**Cause:** Using `uv pip install` without `--system`, or with `--system` which also fails in this image.
**Fix:** Use `uv sync` — it reads `pyproject.toml`, creates a venv, and installs deps automatically.

### "Cannot POST /" or "Method Not Allowed" on root

**Cause:** Keboola platform POSTs to `/` on startup. Your app only handles GET.
**Fix:** Handle all HTTP methods on the root route. In Express: `app.all('/')`. In Flask: `methods=["GET", "POST"]`. Streamlit handles this natively.

### API route returns 500

**Cause:** Missing environment variable not configured in `dataApp.secrets`.
**Fix:** Add all required env vars as secrets. Check server logs via Keboola UI to identify which variable is missing.

### Streaming (SSE/WebSocket) arrives all at once

**Cause:** Nginx buffers the response by default.
**Fix:** Add `proxy_buffering off; proxy_cache off;` to the Nginx location block for streaming endpoints.

### App won't start / restarts in loop

**Cause:** `setup.sh` failed (dependency install error), wrong path in Supervisord config, or missing `uv run` prefix.
**Fix:** Ensure `setup.sh` is executable (`chmod +x`), paths in Supervisord are absolute (`/app/...`), `uv run` prefixes all Python commands, and `uv sync` succeeds.

### WebSocket connection fails (Streamlit blank page)

**Cause:** Nginx not configured for WebSocket upgrade.
**Fix:** Add `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` to the Nginx location block.

### App works locally but not in Keboola

**Cause:** Usually a missing env var, a port mismatch between Nginx and your app, a dependency that fails to install, or missing `uv run` prefix.
**Fix:** Check that Nginx proxies to the same port your app listens on, all env vars are in `dataApp.secrets`, `uv sync` installs everything, and Supervisord commands use `uv run`.

## Deployment Checklist

- [ ] `pyproject.toml` has all Python dependencies listed (not just `requirements.txt`)
- [ ] `keboola-config/setup.sh` — Executable, uses `uv sync` for Python / `npm install` for Node.js
- [ ] `keboola-config/nginx/sites/default.conf` — Listens on 8888, proxies to your app's port
- [ ] `keboola-config/supervisord/services/*.conf` — Absolute paths, correct start command, `uv run` prefix for Python
- [ ] No `[program:nginx]` in your Supervisord configs (base image manages Nginx)
- [ ] Root route handles POST (not just GET) — Streamlit handles this natively
- [ ] All required env vars added as `dataApp.secrets` in Keboola
- [ ] WebSocket apps (Streamlit) have upgrade headers in Nginx
- [ ] Streaming endpoints (if any) have `proxy_buffering off` in Nginx
- [ ] Tested locally before deploying (run same start command as Supervisord uses)
- [ ] No hardcoded port 8888 in your app (Nginx handles that; your app uses an internal port)

## Tips

- **Authentication is optional** — Keboola platform handles access control for data apps. You don't need to add login/auth unless you want additional restrictions.
- **The base image name is misleading** — `keboola/data-app-python-js` has both Python and Node.js runtimes. Use whichever fits your app.
- **Test with the same command** — Run the exact Supervisord `command` locally to catch issues before deploying.
- **Check logs in Keboola UI** — When debugging, the Keboola data app interface shows stdout/stderr from your app.
- **Git branch matters** — Keboola clones a specific branch. Make sure your deployment branch has the `keboola-config/` directory and all config files.
- **Multi-server apps** — You can run multiple processes (e.g., Python API + Node.js frontend) with separate Supervisord config files and route them through different Nginx location blocks.
