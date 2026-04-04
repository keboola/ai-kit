# Keboola Data App Deployment

Guide for deploying Next.js + FastAPI data apps to Keboola Data Apps using the `keboola/data-app-python-js` Docker base image. Based on the canonical [dataapp-deployment](https://github.com/keboola/ai-kit/tree/main/plugins/dataapp-developer/skills/dataapp-deployment) skill with Next.js-specific additions.

---

## Architecture

```text
Internet → Keboola proxy → Docker container
                             ├── Nginx (port 8888, public-facing)
                             │     └── reverse proxy → localhost:<app-port>
                             ├── Supervisord (process manager)
                             │     └── manages app process(es)
                             └── App (any internal port)
```

**Key facts:**
- Base image: `keboola/data-app-python-js` (Debian Bookworm slim with Python, Node.js, Nginx, Supervisord)
- Nginx listens on **port 8888** (required, hardcoded by platform). Only ports ≥ 1024 are supported.
- Your app runs on any internal port (convention: 8050 for FastAPI, 3000 for Node.js/Next.js)
- App code is cloned from Git to `/app/`
- `keboola-config/setup.sh` runs on container startup before the app
- Secrets from `dataApp.secrets` are exported as env vars
- **Keboola platform sends a POST to `/` on startup** — the app must handle this (not just GET)
- The base image manages Nginx automatically — do NOT add `[program:nginx]` in Supervisord configs

## Entrypoint Flow

1. **Input Mapping** — Wait for Data Loader (if configured)
2. **Git Clone** — Clone the repo into `/app/`
3. **Secrets Export** — Export `dataApp.secrets` as environment variables
4. **UV Config** — Configure private PyPI if `pip_repositories` is set
5. **Nginx Validation** — Require at least one `.conf` in `keboola-config/nginx/sites/`
6. **Supervisord Validation** — Require at least one `.conf` in `keboola-config/supervisord/`
7. **setup.sh** — Run `/app/keboola-config/setup.sh` (install deps)
8. **Start** — Launch Supervisord (or `run.sh` if it exists)

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
cd /app/backend && uv sync
```

This means your Python app **must have a `pyproject.toml`** with dependencies listed in the `[project.dependencies]` array. A `requirements.txt` alone is not sufficient.

Similarly, all Python commands in Supervisord **must be prefixed with `uv run`** to execute within the uv-managed environment.

## Required Directory Structure

```text
repo/
├── frontend/                       # Next.js app
│   ├── .next/standalone/           # Pre-built standalone output (committed to git)
│   ├── package.json
│   └── ...
├── backend/                        # FastAPI app
│   ├── pyproject.toml              # Python deps
│   ├── main.py
│   └── ...
├── keboola-config/
│   ├── nginx/
│   │   └── sites/
│   │       └── default.conf        # Nginx reverse proxy config
│   ├── supervisord/
│   │   └── services/
│   │       ├── python.conf         # Python backend process
│   │       └── node.conf           # Node.js frontend process
│   └── setup.sh                    # Startup script (install deps)
└── .gitignore
```

## keboola-config Files

### nginx/sites/default.conf

Multi-backend config supporting health check, API, SSE streaming, and frontend:

```nginx
server {
    listen 8888;
    server_name _;

    # Keboola health probe: POST to root must return 200
    location = / {
        if ($request_method = POST) { return 200; }
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SSE streaming endpoints — MUST come BEFORE /api/ (more specific prefix)
    location /api/chat {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        gzip off;
        tcp_nodelay on;
        add_header X-Accel-Buffering no;
    }

    # API routes (non-streaming)
    location /api/ {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend catch-all (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**For SSE/streaming endpoints** (e.g., `/api/chat`), the required directives (`proxy_buffering off`, `gzip off`, `tcp_nodelay on`, `X-Accel-Buffering no`) are already included in the `/api/chat` location block above. Without `proxy_buffering off`, Nginx buffers the entire response before forwarding — the client sees nothing until the stream ends.

### supervisord/services/ configs

**Python backend (FastAPI) — `python.conf`:**
```ini
[program:python-api]
command=uv run uvicorn main:app --host 127.0.0.1 --port 8050
directory=/app/backend
autostart=true
autorestart=true
startsecs=5
startretries=3
stopsignal=TERM
stopwaitsecs=10
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

**Node.js frontend (Next.js standalone) — `node.conf`:**
```ini
[program:node-frontend]
command=node /app/frontend/.next/standalone/server.js
directory=/app
environment=PORT=3000,HOSTNAME=127.0.0.1
autostart=true
autorestart=true
startsecs=5
startretries=3
stopsignal=TERM
stopwaitsecs=10
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

Use absolute paths (`/app/...`). Relative paths cause startup failures. Always prefix Python commands with `uv run`.

### setup.sh

```bash
#!/bin/bash
set -Eeuo pipefail

# Install Python backend dependencies only.
# Next.js frontend is pre-built (standalone) and committed to git.
cd /app/backend && uv sync
```

Must be executable (`chmod +x`). Runs once on container startup before Supervisord.

**Next.js standalone is pre-built and committed** — the developer runs `npm run build` locally, copies static assets into the standalone directory, and commits `.next/standalone/` to git. This keeps container startup fast (only Python deps need installing).

## pyproject.toml

```toml
[project]
name = "data-app-backend"
version = "0.1.0"
requires-python = ">=3.11,<3.13"
dependencies = [
    "fastapi~=0.115.0",
    "uvicorn~=0.34.0",
    "httpx>=0.27.0",
    "pandas~=2.2.3",
    "requests>=2.31.0",
    "python-dotenv>=1.0.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

**CRITICAL — Python version pinning:** Use `requires-python = ">=3.11,<3.13"`, NOT `">=3.12"` or unbounded `">=3.11"`. The base image ships Python 3.11. Without an upper bound, `uv sync` downloads the latest Python (e.g. 3.14), and pandas/numpy have no pre-built wheels for it — they compile from source, which is slow (~5min) and may fail. Pinning `<3.13` ensures `uv` uses the system Python 3.11 with pre-built wheels for all deps (installs in ~3s).

## .gitignore — CRITICAL

The `.gitignore` must allow `.next/standalone/` (including its `node_modules/`) while ignoring everything else. **Three rules interact and all three must be correct:**

```gitignore
# Dependencies — top-level rule blocks ALL node_modules/ everywhere
node_modules/
# Exception: standalone's bundled node_modules (required for deployment)
!frontend/.next/standalone/node_modules/
!frontend/.next/standalone/node_modules/**

# Next.js — ignore build cache but keep standalone output
frontend/.next/*
!frontend/.next/standalone/
!frontend/.next/standalone/**

# Python build artifacts — MUST be scoped to backend/
# An unscoped dist/ or build/ rule blocks files inside standalone node_modules
# (e.g., next/dist/server/next.js) causing MODULE_NOT_FOUND at runtime
backend/dist/
backend/build/
```

**Common `.gitignore` mistakes that break deployment:**
1. Missing `!frontend/.next/standalone/node_modules/**` → standalone's `next` package not committed → `Cannot find module 'next'` at runtime
2. Unscoped `dist/` rule → blocks `node_modules/next/dist/server/next.js` → same MODULE_NOT_FOUND error
3. Unscoped `build/` rule → blocks files inside standalone node_modules

## Environment Variables / Secrets

Keboola `dataApp.secrets` entries are exported as environment variables:
1. Leading `#` is stripped (Keboola secret marker)
2. Names are uppercased
3. Dashes and spaces become `_`
4. Invalid characters are removed
5. Non-string values (objects, arrays, numbers) are serialized as JSON strings

| dataApp.secrets key | Env var in container | Purpose |
|---|---|---|
| `#KBC_TOKEN` | `KBC_TOKEN` | Keboola Storage API token |
| `#KBC_URL` | `KBC_URL` | Keboola connection URL |
| `#KAI_TOKEN` | `KAI_TOKEN` | KAI assistant token (same value as KBC_TOKEN if no dedicated token) |

Access them in your code as normal environment variables:

```python
import os
token = os.environ.get("KBC_TOKEN")
```

```javascript
const token = process.env.KBC_TOKEN;
```

**If your app already reads env vars locally, it works in Keboola with no code changes** — just add the matching secrets in the data app configuration. Secrets are available to both `setup.sh` and the application runtime.

## Common Errors and Solutions

| Error | Cause | Fix |
|---|---|---|
| `externally-managed-environment` / PEP 668 | Using `pip install` directly | Use `uv sync` in setup.sh, prefix commands with `uv run` |
| `No virtual environment found` | Using `uv pip install` | Use `uv sync` — reads pyproject.toml, creates venv, installs deps |
| `Cannot POST /` or `Method Not Allowed` | App only handles GET on `/` | Use `location = /` with `if ($request_method = POST) { return 200; }` in Nginx |
| `Cannot find module 'next'` / MODULE_NOT_FOUND | standalone `node_modules/` not committed | Fix `.gitignore`: add `!frontend/.next/standalone/node_modules/**`, scope `dist/` → `backend/dist/` |
| `uv` downloads Python 3.14, pandas builds from source | `requires-python` too broad (e.g. `>=3.12`) | Pin `requires-python = ">=3.11,<3.13"` to use base image's Python 3.11 |
| API route returns 500 | Missing env var | Add all required env vars as `dataApp.secrets` |
| Streaming arrives all at once | Nginx buffering enabled | Add `proxy_buffering off; proxy_cache off;` to streaming location |
| App restarts in loop | setup.sh failed or missing `uv run` | Ensure setup.sh is executable, paths absolute, `uv run` prefix |
| WebSocket fails | No upgrade headers in Nginx | Add `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade;` |
| Works locally, fails in Keboola | Missing env var, port mismatch | Verify Nginx port matches app, all env vars in secrets, `uv sync` succeeds |

## Deployment Checklist

- [ ] `pyproject.toml` has all Python dependencies and `requires-python = ">=3.11,<3.13"`
- [ ] `keboola-config/setup.sh` is executable, uses `cd /app/backend && uv sync`
- [ ] `keboola-config/nginx/sites/default.conf` listens on 8888, proxies to correct ports
- [ ] `keboola-config/supervisord/services/*.conf` has absolute paths and `uv run` prefix for Python
- [ ] No `[program:nginx]` in Supervisord configs (base image manages Nginx)
- [ ] Root route handles POST (health probe) via Nginx `location = /`
- [ ] All required env vars added as `dataApp.secrets` (`KBC_TOKEN`, `KBC_URL`, `KAI_TOKEN`)
- [ ] SSE streaming endpoints have `proxy_buffering off`
- [ ] Frontend pre-built: `npm run build` + static assets copied into standalone
- [ ] `.gitignore` allows `frontend/.next/standalone/` AND its `node_modules/`
- [ ] `.gitignore` scopes `dist/` and `build/` rules to `backend/` only
- [ ] `backend/.env` is gitignored (contains tokens — never commit)
- [ ] No hardcoded port 8888 in the app (Nginx handles that)
- [ ] Tested locally with the same start command as Supervisord

---

## Automated Deployment via CLI

Full automation flow for deploying to Keboola from the orchestrator (Phase 5 Stage B). Requires `gh` CLI and `KBC_TOKEN` in `backend/.env`.

**SECURITY:** Verify `backend/.env` is in `.gitignore` before any `git add`. Never commit tokens.

### B1. Build + Push to GitHub

```bash
# Build Next.js standalone output
cd frontend && npm run build \
  && cp -R .next/static .next/standalone/.next/static \
  && cp -R public .next/standalone/public \
  && cd ..

# Initialize git and push
git init
git add -A
git commit -m "Initial data app"
gh repo create {project_name}-dataapp --public --source=. --push
```

Save the repo URL: `https://github.com/{user}/{project_name}-dataapp`

**IMPORTANT:** The `.gitignore` must allow `.next/standalone/` AND its `node_modules/` (see .gitignore section above). Verify `backend/.env` is gitignored before `git add`.

### B2. Determine Data Science API URL

Read `KBC_TOKEN` from `backend/.env`. Map stack to API base URL:

| Stack | Data Science API |
|-------|-----------------|
| AWS US | `https://data-science.keboola.com` |
| AWS EU | `https://data-science.eu-central-1.keboola.com` |
| Azure EU | `https://data-science.north-europe.azure.keboola.com` |
| GCP EU | `https://data-science.europe-west3.gcp.keboola.com` |
| GCP US | `https://data-science.us-east4.gcp.keboola.com` |

### B3. Create Data App via API

**IMPORTANT:** Include git repo URL and secrets in the initial POST — do NOT PATCH them separately (PATCH overwrites and drops fields).

```bash
curl -X POST "{DATA_SCIENCE_API}/apps" \
  -H "X-StorageApi-Token: $KBC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": null,
    "type": "python-js",
    "name": "{APP_NAME}",
    "description": "{APP_DESCRIPTION}",
    "config": {
      "parameters": {
        "size": "small",
        "autoSuspendAfterSeconds": 900,
        "dataApp": {
          "slug": "{app-name-slug}",
          "type": "python-js",
          "secrets": {
            "#KBC_TOKEN": "{KBC_TOKEN_VALUE}",
            "#KBC_URL": "{KBC_CONNECTION_URL}",
            "#KAI_TOKEN": "{KBC_TOKEN_VALUE}"
          },
          "git": {
            "repository": "{GITHUB_REPO_URL}",
            "branch": "main",
            "entrypoint": ""
          }
        }
      },
      "authorization": {
        "app_proxy": {
          "auth_providers": [{"id": "simpleAuth", "type": "password"}],
          "auth_rules": [{"type": "pathPrefix", "value": "/", "auth_required": true, "auth": ["simpleAuth"]}]
        }
      }
    }
  }'
```

Save the returned `id` as `{APP_ID}`.

### B4. Set App to Running

```bash
curl -X PATCH "{DATA_SCIENCE_API}/apps/{APP_ID}" \
  -H "X-StorageApi-Token: $KBC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"desiredState": "running"}'
```

### B5. Poll Until Live (1–2 minutes)

```bash
curl -s "{DATA_SCIENCE_API}/apps/{APP_ID}" \
  -H "X-StorageApi-Token: $KBC_TOKEN" | python3 -c "
import json, sys
app = json.load(sys.stdin)
print(f'State: {app[\"state\"]}, URL: {app.get(\"url\", \"pending\")}')"
```

Poll every 15 seconds until `state` is `running` and `url` is not null.

### B6. Post-Deployment Verification

1. Navigate to the deployed URL with Playwright
2. Take ONE screenshot — verify it matches localhost
3. Check console for errors (CORS, auth, API failures)
4. Click through pages — verify navigation and data
5. Delete all screenshots

**Final report:**

```
Deployment Complete:

LOCALHOST:    PASS
PRODUCTION:  PASS (matches localhost, 0 console errors)

App URL:     {keboola_app_url}
Git repo:    {github_repo_url}
App ID:      {app_id}

All screenshots deleted.
```

Kill any background servers still running.
