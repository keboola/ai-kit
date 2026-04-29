---
name: dataapp-deployment
description: Use when deploying any web app (Python — Streamlit/FastAPI/Flask — or Node.js / TypeScript) to Keboola Data Apps, setting up keboola-config directory, configuring Nginx/Supervisord for Docker, handling SSE or WebSocket streaming through Nginx, mapping secrets to environment variables, accessing Keboola Storage via the Query Service (direct-grant output mapping, keboola-query-service Python or @keboola/query-service JS client), local development setup with workspace tokens, or debugging Keboola Data App deployment issues like POST to root errors, 500s from missing env vars, or buffered streams.
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

## Accessing Keboola Storage (Query Service)

Data Apps can read and write Storage tables directly via the **Keboola Query Service**, without unloading data into the container. This is preferable to bundled CSV input mappings for any app that needs:

- Live reads (the data changes between deployments)
- Writes back into Storage
- Selective queries (filters / aggregations) on large tables

The mechanism is "Storage Access" — a per-app feature you enable in the data app component config. When enabled (and the right output mappings are present), the platform injects four env vars at container startup that the Query Service Python/JS client reads.

### Enabling Storage Access (operator-side configuration)

In the **data app component config** (Keboola UI / API — *not* in your repo):

1. Enable the **Storage Access** toggle.
2. Declare each table you want to **write** to in `storage.output.tables` using `"unload_strategy": "direct-grant"`. This grants the data app's workspace direct write privileges on the destination table instead of unloading data:

```json
{
  "storage": {
    "output": {
      "tables": [
        {
          "destination": "out.c-my-bucket.my-table",
          "unload_strategy": "direct-grant"
        }
      ]
    }
  }
}
```

Reads of any table accessible to the workspace work without an explicit input mapping — the workspace's grants govern what the Query Service will execute.

> The `direct-grant` strategy is what makes the Query Service workable for writes. Without it, the platform tries to unload to the container and back, which is incompatible with live API-driven writes.

**Bucket stage doesn't restrict writes.** The `destination` can be in any stage — `out.`, `in.`, or otherwise — as long as the workspace has write privileges on it. The `out.` examples in this doc are just convention; writing back into an `in.` bucket your workspace owns is equally valid.

### Platform-Provided Environment Variables

When Storage Access is enabled, the platform injects these at container startup. Do NOT add them to `dataApp.secrets` — they come from the platform, not from your secrets list.

| Variable | Purpose |
|---|---|
| `BRANCH_ID` | Storage branch the app is bound to |
| `QUERY_SERVICE_URL` | Stack-specific Query Service endpoint (e.g. `https://query-service.eu-central-1.keboola.com`) |
| `KBC_TOKEN` | Auth token for the Query Service |
| `KBC_WORKSPACE_MANIFEST_PATH` | Path to a JSON file containing `{"workspaceId": "..."}` |

### Python: keboola-query-service client

Add the client to `pyproject.toml`:

```toml
dependencies = [
    "keboola-query-service>=0.2.0",
    # ...
]
```

Wrap it in a single module so route handlers never touch the raw env vars or Client:

```python
# storage.py
"""Thin wrapper around keboola-query-service Client."""
import json
import os
from typing import Any

try:  # dev-only — silently ignored in container
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except ImportError:
    pass

from keboola_query_service import Client


class Storage:
    def __init__(self) -> None:
        self.branch_id = os.environ["BRANCH_ID"]
        with open(os.environ["KBC_WORKSPACE_MANIFEST_PATH"]) as f:
            self.workspace_id = json.load(f)["workspaceId"]
        self.client = Client(
            base_url=os.environ["QUERY_SERVICE_URL"],
            token=os.environ["KBC_TOKEN"],
        )

    def select(self, sql: str) -> list[dict[str, Any]]:
        result = self.client.execute_query(
            branch_id=self.branch_id,
            workspace_id=self.workspace_id,
            statements=[sql],
        )[0]
        cols = [c.name for c in result.columns]
        return [dict(zip(cols, row)) for row in result.data]

    def execute(self, sql: str) -> None:
        self.client.execute_query(
            branch_id=self.branch_id,
            workspace_id=self.workspace_id,
            statements=[sql],
        )


storage = Storage()  # module-level singleton
```

### Node.js / TypeScript: @keboola/query-service client

Add the client to `package.json`:

```bash
npm install @keboola/query-service
# or: pnpm add @keboola/query-service / yarn add @keboola/query-service
```

Wrap it in a single module so route handlers never touch the raw env vars or Client. The same four env vars apply. Load `.env` in your app entrypoint **before** importing this module — keeping dotenv out of `storage.ts` makes the wrapper portable across ESM and CJS.

```typescript
// storage.ts (or storage.js — strip the type annotations)
import { readFileSync } from 'node:fs';
import { Client } from '@keboola/query-service';

const branchId = process.env.BRANCH_ID!;
const workspaceId = JSON.parse(
  readFileSync(process.env.KBC_WORKSPACE_MANIFEST_PATH!, 'utf8'),
).workspaceId as string;

const client = new Client({
  baseUrl: process.env.QUERY_SERVICE_URL!,
  token: process.env.KBC_TOKEN!,
});

export async function select<T = Record<string, unknown>>(
  sql: string,
): Promise<T[]> {
  const [result] = await client.executeQuery({
    branchId,
    workspaceId,
    statements: [sql],
  });
  const cols = result.columns.map((c) => c.name);
  return result.data.map((row: unknown[]) =>
    Object.fromEntries(cols.map((name, i) => [name, row[i]])) as T,
  );
}

export async function execute(sql: string): Promise<void> {
  await client.executeQuery({
    branchId,
    workspaceId,
    statements: [sql],
  });
}
```

In your entrypoint (e.g. `server.ts`), load `.env` once before importing the wrapper:

```typescript
// server.ts (ESM)
import 'dotenv/config';        // dev-only side-effect import; no-op if dotenv isn't installed in the container
import { select, execute } from './storage.js';
// ...
```

For CommonJS apps, the equivalent entrypoint is:

```javascript
// server.js (CommonJS)
require('dotenv').config();
const { select, execute } = require('./storage');
```

…and inside the wrapper itself, use `const { Client } = require('@keboola/query-service')` for the import.

The reads of all four env vars happen at module load — same trade-off as the Python wrapper: missing env vars fail fast, before the first request.

### Reading and Writing

Python:

```python
# Read
rows = storage.select(
    'SELECT "ID", "NAME" FROM "in.c-main"."customers" LIMIT 100'
)

# Write
storage.execute(
    '''INSERT INTO "out.c-data-app"."events" ("id","name")
       VALUES ('abc-123','Click')'''
)
```

Node.js / TypeScript (using the wrapper above):

```typescript
import { select, execute } from './storage';

// Read
const rows = await select<{ ID: string; NAME: string }>(
  'SELECT "ID", "NAME" FROM "in.c-main"."customers" LIMIT 100',
);

// Write
await execute(
  `INSERT INTO "out.c-data-app"."events" ("id","name")
   VALUES ('abc-123','Click')`,
);
```

**Table identifier syntax:** `"<bucket_stage>.<bucket_name>"."<table_name>"` — bucket stage and name in one quoted segment, table name in another. Examples:
- `"in.c-main"."customers"`
- `"out.c-data-app"."mvc-crashes"`

The Query Service supports `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE`. Metadata is refreshed automatically after writes.

### CRITICAL: Validate every SQL input

The Query Service has **no parameterized queries**. Every value interpolated into SQL must be validated and escaped explicitly. Treat every value as untrusted.

Concentrate validation in one module so the rest of your app can't accidentally bypass it:

```python
# validation.py
from typing import Final

BOROUGHS: Final[frozenset[str]] = frozenset({
    "BRONX", "BROOKLYN", "MANHATTAN", "QUEENS", "STATEN ISLAND",
})
MAX_TEXT_LEN: Final[int] = 200


class ValidationError(ValueError):
    pass


def parse_int(v, field):
    try: return int(v)
    except (TypeError, ValueError) as e:
        raise ValidationError(f"{field} must be an integer") from e


def parse_borough(v):
    upper = (v or "").strip().upper()
    if upper not in BOROUGHS:
        raise ValidationError(f"BOROUGH must be one of {sorted(BOROUGHS)}")
    return upper


def escape_sql_text(v, field):
    """Returns inner content; caller wraps in single quotes."""
    if not isinstance(v, str):
        raise ValidationError(f"{field} must be a string")
    if len(v) > MAX_TEXT_LEN:
        raise ValidationError(f"{field} exceeds {MAX_TEXT_LEN}")
    return v.replace("'", "''")
```

Same idea in TypeScript:

```typescript
// validation.ts
export class ValidationError extends Error {}

type Borough = 'BRONX' | 'BROOKLYN' | 'MANHATTAN' | 'QUEENS' | 'STATEN ISLAND';
const BOROUGHS: ReadonlySet<Borough> = new Set<Borough>([
  'BRONX', 'BROOKLYN', 'MANHATTAN', 'QUEENS', 'STATEN ISLAND',
]);

const MAX_TEXT_LEN = 200;
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export function parseInt32(v: unknown, field: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < INT32_MIN || n > INT32_MAX) {
    throw new ValidationError(`${field} must be a 32-bit integer`);
  }
  return n;
}

export function parseBorough(v: unknown): Borough {
  const upper = String(v ?? '').trim().toUpperCase() as Borough;
  if (!BOROUGHS.has(upper)) {
    throw new ValidationError(`BOROUGH must be one of ${[...BOROUGHS].join(', ')}`);
  }
  return upper;
}

export function escapeSqlText(v: unknown, field: string): string {
  if (typeof v !== 'string') throw new ValidationError(`${field} must be a string`);
  if (v.length > MAX_TEXT_LEN) throw new ValidationError(`${field} exceeds ${MAX_TEXT_LEN}`);
  return v.replace(/'/g, "''");
}
```

Rules of thumb (apply in any language):

- Numeric fields → coerce to a native number (Python `int()` / `float()`, JS `Number()` + `Number.isFinite/isInteger`), then interpolate as a bare numeric — not a quoted string.
- Dates / times → parse strictly (Python `datetime.date.fromisoformat`, JS `new Date(iso)` + `isNaN(d.getTime())` rejection), then format to whatever the column expects.
- Categorical fields → enforce against a hard-coded allow-list (Python `frozenset`, JS `Set`).
- Free-text fields → length-cap and double single quotes (`'` → `''`).
- Generated IDs → use a UUID (`uuid.uuid4().hex` in Python, `crypto.randomUUID()` in Node ≥ 14.17), never `MAX(id)+1` (race conditions, and Storage columns are typically `STRING` anyway).

### Local development with Storage Access

The container gets the four env vars from the platform; locally you supply them yourself. Both wrappers above try to load a `.env` file when their respective dotenv package is installed.

**Step 1 — Add a dev dependency for `.env` loading.**

Python (`pyproject.toml`):

```toml
[project.optional-dependencies]
dev = ["python-dotenv>=1.0"]
```

Install with `uv sync --extra dev`.

Node.js (`package.json`):

```json
{
  "devDependencies": {
    "dotenv": "^16.4.5"
  }
}
```

Install with `npm install` (or `pnpm install`). In production / the container, dotenv simply isn't loaded — the import is wrapped in `try/catch`.

**Step 2 — Create a workspace** in your dev project (Storage → Workspaces → New Workspace → SQL/Snowflake). Copy the workspace ID after creation.

**Step 3 — Create a Storage API token** (Settings → API Tokens → New token). Required scopes: read on input buckets, **write on the buckets/tables you `direct-grant`**, plus workspace access. Copy the token value.

**Step 4 — Find your `BRANCH_ID`** (Branches → Default branch → copy the ID).

**Step 5 — Write `.env`** (gitignored):

```
BRANCH_ID=<branch_id>
QUERY_SERVICE_URL=https://query-service.<region>.keboola.com
KBC_TOKEN=<storage_api_token>
KBC_WORKSPACE_MANIFEST_PATH=./workspace.json
```

`<region>` is your stack — e.g. `eu-central-1`, `us-east-1`. The exact URL is the same one the platform sets in the container, so you can copy it from a deployed instance if unsure.

**Step 6 — Write `workspace.json`** (also gitignored):

```json
{ "workspaceId": "<workspace_id_from_step_2>" }
```

**Step 7 — Add to `.gitignore`** so secrets never leak:

```
.env
workspace.json
```

**Step 8 — Run locally** (use whichever matches your app):

```bash
# Python (FastAPI)
uv run uvicorn app.main:app --reload --port 8050

# Python (Streamlit)
uv run streamlit run app.py --server.port 8050

# Node.js
node --watch server.js
```

The exact same wrapper code runs in both environments; the only difference is where the four env vars come from.

### Storage-access-specific errors

**`KeyError: 'BRANCH_ID'` (or any of the four) on app import**
**Cause:** Storage Access isn't enabled on the data app config, or you're running locally without `.env`.
**Fix:** In Keboola — toggle Storage Access on the component config and add the `direct-grant` output mappings. Locally — create `.env` and `workspace.json` per the local-dev steps.

**`Insufficient privileges` / write blocked from the Query Service**
**Cause:** The destination table isn't in `storage.output.tables` with `"unload_strategy": "direct-grant"`. The workspace doesn't have write grants on it.
**Fix:** Add the table to the output mapping. Re-deploy. Confirm via the Keboola UI that the data app config has the table listed.

**`syntax error` from the Query Service**
**Cause:** Malformed table identifier (missing quotes, wrong segment order) or SQL dialect mismatch.
**Fix:** Use `"bucket_stage.bucket_name"."table_name"` — both segments individually double-quoted. The backend is Snowflake by default; use Snowflake SQL functions (`TRY_CAST`, `TRY_TO_DATE`, `COALESCE`, etc.).

**SQL injection-style errors after a user submits weird input**
**Cause:** A value bypassed validation and broke out of its quoted context.
**Fix:** Route all user-provided values through your validation module. The Query Service has no parameterized queries — there is no fallback if you forget to validate.

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

**Storage access in Streamlit.** The Python `storage.py` wrapper from the *Accessing Keboola Storage* section above works as-is. Streamlit reruns the script top-to-bottom on every interaction, but Python's import cache means `from app.storage import storage` returns the same singleton across reruns — so the Query Service client isn't reconstructed each time.

If you instead want lazy initialisation inside the script (e.g. dependent on `st.session_state`), wrap construction with `@st.cache_resource`:

```python
import streamlit as st
from app.storage import Storage

@st.cache_resource
def get_storage() -> Storage:
    return Storage()

storage = get_storage()
rows = storage.select('SELECT * FROM "out.c-data-app"."mvc-crashes" LIMIT 100')
st.dataframe(rows)
```

Wrap the actual SELECT in `@st.cache_data(ttl=60)` if you want the result cached across reruns within a session.

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

**Storage access in Express.** The TypeScript `storage.ts` wrapper from the *Accessing Keboola Storage* section above is module-level — its `Client` is constructed once at import. Use it from any route handler:

```typescript
import { select, execute } from './storage';

app.get('/api/customers', async (_req, res) => {
  const rows = await select('SELECT "ID", "NAME" FROM "in.c-main"."customers" LIMIT 100');
  res.json(rows);
});
```

For a pure-JS / ESM CommonJS setup, do the same with `require('./storage.js')`. Just remember: `process.env.BRANCH_ID` (and the other three) must be set before the module is first imported, or it fails fast at startup.

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
- [ ] **(If using Storage)** Storage Access toggled ON in the data app component config
- [ ] **(If writing to Storage)** Every destination table listed in `storage.output.tables` with `"unload_strategy": "direct-grant"`
- [ ] **(If using Storage)** `keboola-query-service` in `pyproject.toml` and a `storage.py` wrapper present
- [ ] **(If using Storage)** Every SQL value built from user input passes through a validation module — there are no parameterized queries
- [ ] **(If using Storage)** `.env` and `workspace.json` listed in `.gitignore` so dev credentials never leak

## Tips

- **Authentication is optional** — Keboola platform handles access control for data apps. You don't need to add login/auth unless you want additional restrictions.
- **The base image name is misleading** — `keboola/data-app-python-js` has both Python and Node.js runtimes. Use whichever fits your app.
- **Test with the same command** — Run the exact Supervisord `command` locally to catch issues before deploying.
- **Check logs in Keboola UI** — When debugging, the Keboola data app interface shows stdout/stderr from your app.
- **Git branch matters** — Keboola clones a specific branch. Make sure your deployment branch has the `keboola-config/` directory and all config files.
- **Multi-server apps** — You can run multiple processes (e.g., Python API + Node.js frontend) with separate Supervisord config files and route them through different Nginx location blocks.
