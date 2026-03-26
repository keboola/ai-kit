---
name: dataapp-deployment
description: >-
  This skill should be used when deploying any web application to Keboola Data Apps,
  configuring the keboola-config directory structure, setting up Nginx reverse proxy
  with WebSocket or SSE streaming, managing Supervisord processes, mapping dataApp.secrets
  to environment variables, deploying Kai AI Assistant as a chat proxy service, or
  debugging Keboola Data App deployment issues such as POST-to-root failures, PEP 668
  pip errors, buffered streams, WebSocket upgrade failures, or Kai service discovery
  errors. Also covers Kai chat UI patterns including floating chat widgets,
  conversation history, table-to-chart visualization, tool approval UI, and
  streaming message display. Trigger phrases: "deploy to Keboola",
  "set up keboola-config", "configure Nginx", "fix deployment", "deploy Kai",
  "Kai proxy setup", "WebSocket not working", "SSE buffering", "supervisord config",
  "setup.sh", "uv sync failing", "data app won't start", "Cannot POST /",
  "Kai chat deployment", "AI assistant data app", "Kai chat UI", "chat widget",
  "table-to-chart", "conversation history", "tool approval UI",
  "chat entry point", "streaming cursor".
---

# Deploying Web Apps to Keboola Data Apps

Guide for deploying web apps (Node.js, Python, or any language) to Keboola Data Apps using the `keboola/data-app-python-js` Docker base image.

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
- Base image: `keboola/data-app-python-js` (Debian Bookworm slim with Python, Node.js, Nginx, Supervisord). The name is misleading — it supports both runtimes.
- Nginx listens on **port 8888** (required, hardcoded by platform). Only ports >= 1024 are supported.
- The app runs on any internal port (convention: 8050 for FastAPI/Streamlit, 3000 for Node.js, 5000 for Flask).
- App code is cloned from Git to `/app/`.
- `keboola-config/setup.sh` runs on container startup before the app.
- Secrets from `dataApp.secrets` are exported as environment variables.
- **Keboola platform sends a POST to `/` on startup** — the app must handle this (not just GET).
- The base image manages Nginx automatically — do NOT add `[program:nginx]` in Supervisord configs.

## Entrypoint Flow

The container startup sequence:

1. **Input Mapping** — Wait for Data Loader (if configured)
2. **Git Clone** — Clone the repo into `/app/`
3. **Secrets Export** — Export `dataApp.secrets` as environment variables
4. **UV Config** — Configure private PyPI if `pip_repositories` is set
5. **Nginx Validation** — Require at least one `.conf` in `keboola-config/nginx/sites/`
6. **Supervisord Validation** — Require at least one `.conf` in `keboola-config/supervisord/`
7. **setup.sh** — Run `/app/keboola-config/setup.sh` (install deps)
8. **Start** — Launch Supervisord (or `run.sh` if it exists)

## Python Dependency Management — CRITICAL

The base image uses `uv` to manage Python. Bare `pip` is blocked (PEP 668). Do NOT use `pip install` or `uv pip install` — both fail in this environment.

**The correct approach:**
```bash
cd /app && uv sync
```

This reads `pyproject.toml`, creates a venv, and installs everything. The app **must have a `pyproject.toml`** with dependencies in `[project.dependencies]`. Prefix all Python commands in Supervisord with `uv run`.

## Required Directory Structure

```text
repo/
├── keboola-config/
│   ├── nginx/
│   │   └── sites/
│   │       └── default.conf        # Nginx reverse proxy config
│   ├── supervisord/
│   │   └── services/
│   │       └── app.conf            # Process manager config
│   └── setup.sh                    # Startup script (install deps)
├── pyproject.toml                  # Python deps (required for Python apps)
└── <app files>
```

## keboola-config Files

### nginx/sites/default.conf

Annotated multi-backend config supporting health check, API, and frontend routing:

```nginx
server {
    listen 8888;
    server_name _;

    # Keboola health probe: POST to root must return 200
    location = / {
        if ($request_method = POST) { return 200; }
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # App catch-all
    location / {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Change `8050` to match the app's internal port. For **WebSocket apps** (Streamlit, etc.), add upgrade headers to the relevant location block:

```nginx
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
```

For **streaming endpoints** (SSE, long-polling), disable buffering:

```nginx
        proxy_buffering off;
        proxy_cache off;
        gzip off;
        tcp_nodelay on;
        add_header X-Accel-Buffering no;
```

Without `proxy_buffering off`, Nginx buffers the entire response — the client sees nothing until the stream ends.

For the full Kai-specific Nginx config with WebSocket + SSE + polling location blocks, see `references/kai-deployment.md`.

### supervisord/services/app.conf

Canonical example (FastAPI with uvicorn):

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

**Variants:** For Streamlit: `command=uv run streamlit run /app/streamlit_app.py --server.port 8050 --server.headless true`. For Gunicorn: `command=uv run gunicorn --bind 0.0.0.0:5000 app:app`. For Node.js: `command=node /app/server.js` (no `uv run` prefix). For multi-server Kai apps (Python + Node.js), see `references/kai-deployment.md`.

Use absolute paths (`/app/...`). Relative paths cause startup failures.

### setup.sh

**Python:**
```bash
#!/bin/bash
set -Eeuo pipefail
cd /app && uv sync
```

**Node.js:**
```bash
#!/bin/bash
set -Eeuo pipefail
cd /app && npm install
```

Must be executable (`chmod +x`). Runs once on container startup before Supervisord starts the app.

## pyproject.toml (Required for Python Apps)

```toml
[project]
name = "my-data-app"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "streamlit~=1.45.1",
    "pandas~=2.2.3",
    "requests>=2.31.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

If migrating from `requirements.txt`, move all dependencies into `[project.dependencies]` with version specifiers.

## Environment Variables / Secrets

Keboola `dataApp.secrets` entries are exported as environment variables with these transformations:
1. Leading `#` stripped (Keboola secret marker)
2. Names uppercased
3. Dashes and spaces become `_`
4. Invalid characters removed
5. Non-string values serialized as JSON strings

| dataApp.secrets key | Env var in container |
|---|---|
| `#KBC_TOKEN` | `KBC_TOKEN` |
| `#KBC_URL` | `KBC_URL` |
| `#KBC_DATABASE_NAME` | `KBC_DATABASE_NAME` |
| `#ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` |
| `#my-custom-var` | `MY_CUSTOM_VAR` |

Secrets are available to both `setup.sh` and the application runtime. If the app already reads env vars locally, it works in Keboola with no code changes — add matching secrets in the data app configuration.

For Kai-specific env vars (KBC_TOKEN, KBC_URL, KAI_TOKEN, KBC_PROJECTID), see `references/kai-deployment.md`.

## Deploying Kai AI Assistant (Chat Client)

Keboola's Kai AI Assistant can be embedded in a Data App as a chat interface. The architecture: the Data App backend acts as a proxy between the frontend and Keboola's hosted Kai service, keeping credentials server-side.

```text
Browser → Nginx :8888 → FastAPI :8050 → Kai service (Keboola-hosted)
                       → Next.js :3000 (frontend)
```

Key infrastructure requirements:
- **Backend** discovers the Kai service URL from the Storage API at startup, authenticates with KBC_TOKEN, and proxies SSE streams to the client
- **Nginx** needs three chat-specific location blocks: WebSocket (`/api/chat/ws`), polling (`/api/chat`), and REST (`/api/`)
- **WebSocket** is the primary transport (zero-latency). Polling is the fallback for environments where the edge proxy kills long-lived connections (~20-30s timeout)
- **Tool approval flow**: Kai may request permission to run tools — the frontend shows approve/deny UI, sends the response back through the proxy

For the complete Kai deployment guide including backend proxy code, Nginx configuration, frontend WebSocket client, SSE event types, system context injection, environment variables, supervisord multi-server setup, and dev proxy configuration, see **`references/kai-deployment.md`**.

## Kai Chat UI Patterns (Optional)

The infrastructure above provides a working Kai chat proxy. The UI can be as simple as a text input and message list. For apps that need a richer chat experience, production-tested UI patterns are available covering:

- **Chat entry points** — floating widget (bottom-right bubble) and/or full-page chat route
- **Message display** — role-distinct bubbles, streaming cursor with stalling detection, markdown rendering with internal link handling
- **Table-to-chart** — auto-detect chart type from markdown tables (bar, line, pie, scatter, waterfall), toggle between table/chart view, CSV export
- **Conversation history** — sidebar panel with search, rename, delete, export; localStorage persistence (max 50 conversations)
- **Context-aware suggestions** — initial suggestions from page context, follow-up pills parsed from Kai's `next_actions` code block
- **Tool execution progress** — collapsible step display with friendly names and descriptions from `input.justification`
- **Tool approval UI** — amber warning bar with approve/deny buttons, input disabled while pending
- **Instant preview** — match entity names against cached dashboard data for immediate feedback before Kai responds
- **Response caching** — 5-minute TTL keyed by query text, with cache badge and refresh bypass
- **Portal & z-index strategy** — all floating UI via `ReactDOM.createPortal` to avoid stacking context issues

Each pattern is self-contained and can be adopted independently. For implementation details, see **`references/kai-chat-ui-patterns.md`**.

## Common Errors and Solutions

| Error | Cause | Fix |
|---|---|---|
| `externally-managed-environment` / PEP 668 | Using `pip install` directly | Use `uv sync` in setup.sh, prefix commands with `uv run` in Supervisord |
| `No virtual environment found` | Using `uv pip install` | Use `uv sync` — reads `pyproject.toml`, creates venv, installs deps |
| `Cannot POST /` or `Method Not Allowed` on root | App only handles GET on `/` | Handle all HTTP methods on root. Express: `app.all('/')`. Flask: `methods=["GET", "POST"]`. Streamlit handles this natively. |
| API route returns 500 | Missing env var not in `dataApp.secrets` | Add all required env vars as secrets. Check server logs in Keboola UI. |
| Streaming arrives all at once | Nginx buffering enabled | Add `proxy_buffering off; proxy_cache off;` to the streaming location block |
| App restarts in loop | `setup.sh` failed, wrong path, or missing `uv run` | Ensure setup.sh is executable, paths are absolute, `uv run` prefixes Python commands |
| WebSocket fails (Streamlit blank) | No upgrade headers in Nginx | Add `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` |
| Works locally, fails in Keboola | Missing env var, port mismatch, or dep install failure | Verify Nginx port matches app port, all env vars in secrets, `uv sync` succeeds |
| `kai-assistant not found` | Kai not enabled, or token lacks access | Verify Kai is enabled for the project. Try dedicated KAI_TOKEN. See `references/kai-deployment.md`. |
| WebSocket 502 on `/api/chat/ws` | Missing upgrade headers or backend down | Add WebSocket headers to `/api/chat/ws` location. Check backend logs. See `references/kai-deployment.md`. |

## Deployment Checklist

- [ ] `pyproject.toml` has all Python dependencies (not just `requirements.txt`)
- [ ] `keboola-config/setup.sh` — executable, uses `uv sync` for Python / `npm install` for Node.js
- [ ] `keboola-config/nginx/sites/default.conf` — listens on 8888, proxies to the app's port
- [ ] `keboola-config/supervisord/services/*.conf` — absolute paths, correct command, `uv run` prefix for Python
- [ ] No `[program:nginx]` in Supervisord configs (base image manages Nginx)
- [ ] Root route handles POST (not just GET)
- [ ] All required env vars added as `dataApp.secrets`
- [ ] WebSocket apps have upgrade headers in Nginx
- [ ] Streaming endpoints have `proxy_buffering off` in Nginx
- [ ] Tested locally with the same start command as Supervisord
- [ ] No hardcoded port 8888 in the app (Nginx handles that; the app uses an internal port)
- [ ] **Kai:** token has Kai access, Nginx has `/api/chat/ws` and `/api/chat` location blocks (see `references/kai-deployment.md`)
- [ ] **Kai:** backend pre-warms Kai URL discovery, uses persistent httpx client
- [ ] **Kai:** frontend uses `wss://` in production, `ws://` in dev

## References

Detailed patterns and production-tested configurations:

- **`references/kai-deployment.md`** — Complete guide for deploying Kai AI Assistant: backend proxy (FastAPI), Nginx config with WebSocket + SSE + polling, frontend streaming client, SSE event types, tool approval flow, system context injection, environment variables, supervisord multi-server, Next.js dev proxy, error patterns, and deployment checklist.
- **`references/kai-chat-ui-patterns.md`** — Optional feature catalog for Kai chat UI: floating widget, full-page chat, message display with streaming cursor, table-to-chart visualization, conversation history panel, context-aware suggestions, tool approval UI, instant preview, response caching, animations, accessibility, portal/z-index strategy.
