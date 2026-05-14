# Python/JS Apps

**Use this when:** you're building, modifying, or debugging a Python/JS app on Keboola — single Node, single Python, or combined Python+Node.

## The /app contract

The base image clones your repo to `/app` at container startup. That directory is the entire surface the platform looks at. Two files (or sets of files) are required:

- `keboola-config/nginx/sites/*.conf` — at least one nginx server block listening on `8888`.
- `keboola-config/supervisord/services/*.conf` — at least one supervisord `[program:]` entry that starts your app process.

Two more are optional:

- `keboola-config/setup.sh` — runs once before the app starts. This is where you install dependencies (`uv sync`, `npm install`, etc.).
- `run.sh` — if present at the repo root, overrides the default supervisord startup. You almost never want this.

The contract is fixed: same paths, same filenames, same port. The only customisable stage of the entrypoint flow is the bootstrap hook — see [the advanced section](#bootstrap-hook-advanced) below. Everything else is the base image's job, not yours.

## Nginx

Nginx listens on port `8888` inside the container. That port is hardcoded by the platform; the proxy routes external traffic to it. Only ports `>=1024` work — anything privileged is blocked because the container does not run as root.

Nginx's only job is to reverse-proxy to whatever internal port your app listens on. Minimal `keboola-config/nginx/sites/default.conf`:

```nginx
server {
    listen 8888;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

WebSocket upgrade snippet — add inside the `location` block for Streamlit, Dash, or any app that pushes updates over a live socket. Without it the page loads but never updates:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;
```

SSE / streaming snippet — disable buffering or the client sees the entire response only after the stream ends, which defeats the point of streaming:

```nginx
proxy_buffering off;
proxy_cache off;
proxy_request_buffering off;
```

## Supervisord

Supervisord starts and supervises your app processes. Three rules that catch people out:

- Absolute `/app/...` paths only. Relative paths cause startup failures because supervisord's CWD is not what you think it is.
- Python commands MUST be prefixed with `uv run` to pick up the `uv`-managed venv. A bare `python app.py` runs the wrong interpreter.
- Never declare `[program:nginx]`. The base image manages nginx automatically; declaring it yourself causes a conflict and one of the two starts fails.

Sample `keboola-config/supervisord/services/app.conf` for Python via uv:

```ini
[program:app]
command=uv run python /app/app.py
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

Sample for Node:

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

Sample for Gunicorn (Flask in production):

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

Send logs to `/dev/stdout` and `/dev/stderr` so the platform log viewer can pick them up. Files under `/app` are ephemeral and disappear with the container, so writing logs to disk loses them on every restart.

`autorestart=true` is important: when the platform's startup health check pokes the app, the worst failure mode is a crashed process that never comes back. With autorestart, a transient init failure recovers on its own and the next health check succeeds.

## POST handling on /

Keboola POSTs to `/` on startup to verify the app is alive. The app MUST accept POST on the root path or the platform startup check returns "Method Not Allowed" and the app appears broken even though it works locally. This is the single most common "but it works on my machine" failure mode for Python/JS apps.

Flask:

```python
@app.route("/", methods=["GET", "POST"])
def index():
    return "Hello"
```

Express:

```javascript
app.all('/', (req, res) => res.send('Hello'));
// NOT app.get('/') — that returns 405 on the startup POST
```

Streamlit handles this natively; you don't need to do anything.

If you only see this failure once the app is deployed and never locally, that's the tell — your local browser sends GET, the platform sends POST, and a handler registered only for GET returns 405.

## Python dependencies

`pyproject.toml` is required. `pip install` is blocked by PEP 668 in the base image — `setup.sh` MUST use `uv sync`. All supervisord commands for Python MUST be prefixed with `uv run` so they execute inside the `uv`-managed venv that `uv sync` populated.

Minimal `pyproject.toml`:

```toml
[project]
name = "my-keboola-app"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "flask>=3.0.0",
    "pandas>=2.0.0",
    "requests>=2.31.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

If migrating from `requirements.txt`, move all deps into the `dependencies` array. Delete `requirements.txt` after the move so it doesn't bit-rot alongside `pyproject.toml`.

## Preferred shape for dashboarding: single Node + static frontend

This is the dashboarding default. Express (or similar) on a single internal port (e.g. `:3000`) serving BOTH:

- `/api/*` JSON endpoints that call `runQuery` against the Keboola workspace.
- The static frontend at `/` (`public/index.html` + `public/app.js` + CSS).

The frontend loads Tailwind and Chart.js via CDN. No bundler, no build step, no `npm run build` to remember. One supervisord program, one nginx location block, one `setup.sh` line (`npm install`). The whole thing fits in a single repo with a flat structure.

Why this shape wins for dashboards:

- One process means one place to read logs and one port to map.
- Static frontend served from the same Node process means no CORS, no proxy plumbing, no separate deploy of frontend assets.
- DuckDB caching lives inside the same Node process, so cache hits never cross a process boundary.

Pairs with [duckdb-caching.md](duckdb-caching.md) by default — for read-only dashboards, cache once into an in-memory DuckDB so the dashboard never re-hits Snowflake on a page render. The cache and the API server live in the same process.

Runnable starter: `templates/nodejs-app/`.

## Multi-server pattern (Python backend + JS frontend) — use when you need it

Reach for this only when you actually need a Python backend — an existing Python codebase, an ML model in Python, FastAPI/Flask services that are hard to port. For pure dashboarding the simpler single-Node shape (above) is preferred. Two processes mean two log streams, two ports, two dependency installs, and a more involved local-dev story.

Backend convention: Python on `:8050`.
Frontend convention: Node on `:3000`. For bundled toolchains (Next.js, Vite), the frontend is pre-built and **committed to git** so `setup.sh` only installs deps — it does NOT run a build step. Building during `setup.sh` is slow and makes startup unreliable.

Nginx — two location blocks, more specific path first so it matches before the catch-all:

```nginx
server {
    listen 8888;
    server_name _;

    location /api/ {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Supervisord — one `[program:]` per process, in separate `.conf` files (`backend.conf`, `frontend.conf`) so each can be enabled, restarted, and reasoned about independently.

`setup.sh` parallel install — both stacks install at the same time so cold start is roughly `max(python_deps, node_deps)` rather than the sum:

```bash
#!/bin/bash
set -Eeuo pipefail
cd /app/backend && uv sync &
cd /app/frontend && npm install &
wait
```

Local dev: skip nginx and supervisord entirely. Run each process in its own terminal. Use the frontend dev server's proxy to route `/api/*` to the backend — Next.js: `rewrites` in `next.config.ts`; Vite: `server.proxy` in `vite.config.ts`. That way the frontend code calls `/api/...` everywhere and it works the same locally as in Keboola.

User-identity passthrough across the local-vs-Keboola boundary (e.g. injecting an email header for testing) is app-specific convention, not a platform feature — see the placeholder in [storage-access.md](storage-access.md).

Runnable starter: `templates/python-node-app/`.

## Local development

Skip nginx and supervisord locally. They exist only for the Keboola container contract — running them locally adds a layer of indirection that obscures problems instead of revealing them.

Install:

- Python: `cd /app && uv sync`
- Node: `cd /app && npm install`

Run directly:

- Flask: `uv run python app.py`
- FastAPI: `uv run uvicorn app:app --reload --port 5000`
- Express: `node --watch server.js`
- Bundled frontends: `npm run dev` (Vite, Next.js)

Visit `http://localhost:<internal-port>` directly. Do NOT add a local nginx on `:8888` — there's no reason to.

Local secrets: load from `.env` (Node) or `.streamlit/secrets.toml` (works for both types) or shell exports. Mirror the env-var names Keboola injects (`KBC_URL`, `KBC_TOKEN`, `KBC_WORKSPACE_ID`, `BRANCH_ID`) so the same code paths run unchanged in both places. See [storage-access.md](storage-access.md) §Getting the env vars for local development for how to obtain each value (`KBC_URL`, `KBC_TOKEN`, `KBC_WORKSPACE_ID`).

Env-parity pattern: read from `process.env.X` / `os.environ.get("X")` everywhere. In dev, populate those from your local file. The same code runs unchanged in Keboola where `dataApp.secrets` populates the same env vars.

Quick sanity check: run the EXACT command your `supervisord/services/app.conf` uses (just point to the right interpreter). If it works locally, it works in Keboola. If it doesn't work locally, no amount of redeploying will fix it.

Multi-server local dev: run each process in its own terminal; frontend dev server proxies `/api/*` to backend.

For the validate -> build -> verify change loop, see [dev-workflow.md](dev-workflow.md).

## Keboola-hosted dev mode

When the platform sets `KBC_APP_MODE=dev` on the container, the image hot-reloads off the configured git branch. You don't have to redeploy on every push — the running container polls the branch and pulls changes. To opt in, add:

- `keboola-config/supervisord-dev/<program>.conf` — required for dev mode. Hot-reload variant of your supervisord configs (e.g. `streamlit run app.py --server.runOnSave=true`, or `uvicorn --reload`, or `node --watch`).
- `keboola-config/setup-dev.sh` — optional. Dev-time dependency install. Falls back to `setup.sh` if absent.
- `keboola-config/dev-deps` — optional. List of dependency file paths the in-pod watcher hashes for change detection. Lines starting with `#` and blank lines are ignored.

Env vars:

- `KBC_APP_MODE` — `prod` (default) or `dev`. Set by the platform.
- `KBC_GIT_POLL_INTERVAL` — integer seconds, default `1`.
- `KBC_DEV_AUTO_SETUP` — `1` (default) or `0`. When `0`, dep-file changes are detected and logged but `setup-dev.sh` is NOT auto-run. Useful when you want to control reinstalls yourself.

For the full author contract see the base image's dev-mode documentation.

## Git commit locking

Always enabled. The platform locks each deploy to a specific commit SHA, so a deploy is reproducible even if the branch moves underneath you.

- On first deploy: shallow clone of latest, save the SHA to state.
- On subsequent deploys: full clone, checkout the saved SHA.

Exit code **153** means the locked commit no longer exists in the remote (force-push, history rewrite, branch deletion). Fix: either restore the missing commit (revert the force-push, restore the branch) or trigger a fresh deploy that re-locks to current HEAD.

## Bootstrap hook (advanced)

Customers usually don't touch this. The base image's `src/hooks/bootstrap-app.sh` runs at container startup and is the only customizable stage of the entrypoint flow. Default behavior: shell out to `git-clone.sh /app`.

Derived images can replace the hook to:

- Bake a fixed `keboola-config/` into the image at build time.
- Skip git clone entirely (app baked into the image).
- Fetch source from non-git sources (S3, registry, etc.).
- Materialise app source from `/data/config.json` (inline-script mode).

See the base image's bootstrap documentation.

## Deployment via MCP (Keboola-managed git) — PLACEHOLDER

Future flow: provision a Keboola-managed git repo for the Python/JS app through MCP tooling, so customers don't have to supply their own GitHub/GitLab.

Planned developer flow: feature branch -> preview deployment -> merge to main -> production deployment.

**Status today: not yet finished.** Agents working on Python/JS apps fall back to **customer-provided git** (private GitHub/GitLab with PAT or SSH key) as the only supported path.

When the platform support lands, this section expands. If it grows past ~50 lines, split it into its own reference.
