# mcp-data-app Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `mcp-data-app` skill to the `dataapp-developer` plugin that lets an agent host any MCP server as a single-tenant Keboola data app — scaffold, secrets, git, deploy, verify, connect — with the Keboola MCP server as the worked example.

**Architecture:** A router-style skill (`SKILL.md` + `reference/` + bundled `template/` + a `scaffold.sh` helper). The bundled template is the proven `keboola-rnd/mcp-data-app-example` code (Starlette auth wrapper + `keboola-config/` trio). The skill defers container mechanics to the existing `dataapp-development` skill and deploy plumbing to the `keboola-git` skill / hosted MCP tools, contributing only the MCP-hosting-specific content.

**Tech Stack:** Markdown skills (Agent Skills format), Python 3.11+ (Starlette/uvicorn/FastMCP wrapper, `uv`), Bash (scaffold script), nginx + supervisord config, `kbagent` / hosted Keboola MCP tools for deploy.

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-07-mcp-data-app-skill-design.md`. Every task's requirements implicitly include it.
- Skill lives at `plugins/dataapp-developer/skills/mcp-data-app/` (new sibling to `dataapp-development`).
- Script convention (repo CLAUDE.md): scripts self-detect location with `SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"` and derive `SKILL_DIR="$(dirname "$SCRIPT_DIR")"`; scripts run from the **user's project root**, never the skill dir; SKILL.md must include a "Working Directory Context" section stating this.
- Upstream pin in the template: `keboola-mcp-server @ git+https://github.com/keboola/keboola-mcp-server.git@v1.73.1` (latest stable at plan time).
- App-level auth for a deployed MCP data app MUST be **None** (platform OIDC strips `Authorization`).
- Python data-app rules (from `dataapp-development/references/python-js-apps.md`): `pyproject.toml` required; **no `pip install`** (`uv sync` only); supervisord Python commands prefixed with `uv run`; **never** declare `[program:nginx]`; nginx listens on **8888**; app must accept `POST /`.
- Versioning (repo CLAUDE.md): bump `plugins/dataapp-developer/.claude-plugin/plugin.json` and the matching entry in `.claude-plugin/marketplace.json`; update the plugin README and the root README feature list.
- Do NOT modify `deployment-paths.md`'s Python/JS-via-MCP "placeholder" wording, the stale `keboola-git` cross-references, or add a `kai-client` UI (all explicit non-goals).
- Secret names (exact): `#KBC_STORAGE_API_URL`, `#KBC_STORAGE_TOKEN`, `#MCP_API_KEY`, `#MCP_PUBLIC_URL`; optional `KBC_WORKSPACE_SCHEMA`, `LOG_LEVEL`, `PORT`.
- Work on branch `feat/mcp-data-app-skill`. Commit after each task.

---

## Task 1: Bundle the template (`template/`)

**Files:**
- Create: `plugins/dataapp-developer/skills/mcp-data-app/template/server.py`
- Create: `plugins/dataapp-developer/skills/mcp-data-app/template/pyproject.toml`
- Create: `plugins/dataapp-developer/skills/mcp-data-app/template/keboola-config/nginx/sites/default.conf`
- Create: `plugins/dataapp-developer/skills/mcp-data-app/template/keboola-config/supervisord/services/mcp-server.conf`
- Create: `plugins/dataapp-developer/skills/mcp-data-app/template/keboola-config/setup.sh`
- Create: `plugins/dataapp-developer/skills/mcp-data-app/template/.gitignore`

**Interfaces:**
- Produces: a self-contained, deployable Keboola-MCP data app tree. Consumed by Task 2 (`scaffold.sh` copies it) and referenced by Tasks 3–6. Swap points (mount block in `server.py`, deps in `pyproject.toml`) are the extension surface documented in Task 5.

- [ ] **Step 1: Create `template/server.py`** — verbatim from `keboola-rnd/mcp-data-app-example`, with two added `# ── SWAP POINT` banner comments pointing at the adapting reference. Full content:

```python
"""Keboola MCP Server hosted as a single-tenant Keboola data app.

This file is the example template. It does two things:

1. Mounts the upstream `keboola-mcp-server` FastMCP app at `/mcp` so all
   Keboola tools (storage, components, transformations, jobs, flows, …)
   are available over Streamable-HTTP.
2. Adds two pluggable client-auth patterns in front of `/mcp`:
   - **Static bearer**: middleware checks `Authorization: Bearer <MCP_API_KEY>`.
   - **OAuth-shape stubs**: five extra endpoints (`/.well-known/oauth-*`,
     `/register`, `/authorize`, `/token`) impersonate an OAuth 2.1 AS so
     Claude Desktop's "Add custom connector" GUI works against this server.
     `/token` requires `client_secret == MCP_API_KEY` and returns
     `MCP_API_KEY` itself as the `access_token`. Same security profile as
     the static bearer — URL + key still gate everything.

Required env vars (set as data-app secrets):
    KBC_STORAGE_API_URL     Your Keboola stack, e.g.
                            https://connection.us-east4.gcp.keboola.com
    KBC_STORAGE_TOKEN       Storage API token scoping THIS data app to a
                            project. Create at Project Settings → API tokens.
                            All MCP tools run with this token's permissions.
    MCP_API_KEY             You generate. Doubles as the static bearer and
                            the `client_secret` for the OAuth-shape flow.
                            `openssl rand -hex 32`.

Optional env vars:
    KBC_WORKSPACE_SCHEMA    Schema for SQL transformation tools. Find it in
                            your project's Snowflake/BigQuery workspace.
    MCP_PUBLIC_URL          Externally reachable origin, no trailing slash,
                            no `/mcp`. Required for the OAuth-shape flow so
                            discovery documents advertise correct URLs.
                            Defaults to http://localhost:5000 for local dev.
    PORT                    Defaults to 5000 (Keboola data-app convention).
    LOG_LEVEL               Defaults to INFO.
"""

from __future__ import annotations

import base64
import contextlib
import hmac
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator
from urllib.parse import urlencode

# ── SWAP POINT (imports): wrapping a DIFFERENT MCP server? Replace the three
# keboola_mcp_server imports below with your server's FastMCP factory. The
# Starlette + auth + OAuth-shape machinery in the rest of this file is
# server-agnostic — leave it. See reference/adapting-to-any-server.md.
from keboola_mcp_server.config import Config, ServerRuntimeInfo
from keboola_mcp_server.mcp import ForwardSlashMiddleware
from keboola_mcp_server.server import create_server
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse, Response
from starlette.routing import Mount, Route

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("keboola-mcp-data-app")

# --- Required env vars ------------------------------------------------------
MCP_API_KEY = os.environ["MCP_API_KEY"]
MCP_PUBLIC_URL = os.environ.get("MCP_PUBLIC_URL", "http://localhost:5000").rstrip("/")

# Build the Keboola MCP Server config from KBC_*-prefixed env vars; see
# keboola_mcp_server.config.Config for the full list of fields.
config = Config.from_dict(dict(os.environ))
if not config.storage_api_url or not config.storage_token:
    raise SystemExit(
        "Missing required env vars: set KBC_STORAGE_API_URL and KBC_STORAGE_TOKEN "
        "(see README)."
    )

# Paths that bypass bearer auth: health probe + the OAuth-shape stubs that
# Claude calls before it has a token.
ANON_PATHS = frozenset({
    "/healthz",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-authorization-server",
    "/register",
    "/authorize",
    "/token",
})


# --- Bearer auth middleware -------------------------------------------------

class BearerAuthMiddleware(BaseHTTPMiddleware):
    """Reject any request not bearing `Authorization: Bearer $MCP_API_KEY`.

    ANON_PATHS bypass auth so the platform health probe and the OAuth-shape
    discovery endpoints work without a token. 401 responses carry a
    spec-compliant `WWW-Authenticate: Bearer resource_metadata=...` header
    so MCP clients can discover the OAuth-shape endpoints.
    """

    _challenge = (
        f'Bearer realm="keboola-mcp-data-app", '
        f'resource_metadata="{MCP_PUBLIC_URL}/.well-known/oauth-protected-resource"'
    )

    async def dispatch(self, request: Request, call_next):
        # ASGI mounts at /mcp/* receive paths starting with /mcp; anon paths
        # are exact matches.
        if request.url.path in ANON_PATHS:
            return await call_next(request)

        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse(
                {"error": "missing bearer token"},
                status_code=401,
                headers={"WWW-Authenticate": self._challenge},
            )
        if not hmac.compare_digest(auth[len("Bearer ") :], MCP_API_KEY):
            return JSONResponse(
                {"error": "invalid bearer token"},
                status_code=401,
                headers={"WWW-Authenticate": self._challenge},
            )
        return await call_next(request)


# --- OAuth-shape stubs ------------------------------------------------------
# These let Claude Desktop / claude.ai's "Add custom connector" GUI complete
# its OAuth dance against this server without us standing up a real AS. The
# real gate is /token; everything else is the spec-required shape.

async def _healthz(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "keboola-mcp-data-app"})


async def _protected_resource_metadata(_: Request) -> JSONResponse:
    return JSONResponse({
        "resource": f"{MCP_PUBLIC_URL}/mcp",
        "authorization_servers": [MCP_PUBLIC_URL],
        "bearer_methods_supported": ["header"],
    })


async def _authorization_server_metadata(_: Request) -> JSONResponse:
    return JSONResponse({
        "issuer": MCP_PUBLIC_URL,
        "authorization_endpoint": f"{MCP_PUBLIC_URL}/authorize",
        "token_endpoint": f"{MCP_PUBLIC_URL}/token",
        "registration_endpoint": f"{MCP_PUBLIC_URL}/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": [
            "client_secret_post",
            "client_secret_basic",
            "none",
        ],
        "scopes_supported": ["mcp"],
    })


async def _register(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        body = {}
    return JSONResponse({
        "client_id": "keboola-mcp-static",
        "client_id_issued_at": int(time.time()),
        "redirect_uris": body.get("redirect_uris", []),
        "grant_types": ["authorization_code"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "client_secret_post",
    }, status_code=201)


async def _authorize(request: Request) -> Response:
    q = request.query_params
    redirect_uri = q.get("redirect_uri")
    if not redirect_uri:
        return JSONResponse(
            {"error": "invalid_request", "error_description": "missing redirect_uri"},
            status_code=400,
        )
    params = {"code": secrets.token_urlsafe(16)}
    if state := q.get("state"):
        params["state"] = state
    sep = "&" if "?" in redirect_uri else "?"
    return RedirectResponse(f"{redirect_uri}{sep}{urlencode(params)}", status_code=302)


def _basic_auth_secret(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("basic "):
        return None
    try:
        decoded = base64.b64decode(auth[len("Basic ") :]).decode("utf-8")
    except Exception:
        return None
    _, _, secret = decoded.partition(":")
    return secret or None


async def _token(request: Request) -> JSONResponse:
    """The actual gate. Require client_secret == MCP_API_KEY; return the same
    key as the access_token so the bearer middleware on /mcp accepts it.
    """
    form = await request.form()
    secret = form.get("client_secret") or _basic_auth_secret(request)
    if not secret or not hmac.compare_digest(str(secret), MCP_API_KEY):
        log.info("token request rejected: bad or missing client_secret")
        return JSONResponse(
            {"error": "invalid_client"},
            status_code=401,
            headers={"WWW-Authenticate": 'Basic realm="keboola-mcp-data-app"'},
        )
    log.info("token request accepted client_id=%s", form.get("client_id", "<none>"))
    return JSONResponse({
        "access_token": MCP_API_KEY,
        "token_type": "Bearer",
        "expires_in": 31536000,  # 1y — static key; rotation = redeploy
        "scope": "mcp",
    })


# ── SWAP POINT (mount): the block below builds the Keboola MCP FastMCP app and
# mounts it at /mcp. For a different FastMCP server, replace the create_server
# call + custom_routes handling with your server's `.http_app(path="/",
# transport="streamable-http", stateless_http=True)`. Keep the Mount("/mcp", …)
# and everything after it. See reference/adapting-to-any-server.md.
# --- Mount the upstream Keboola MCP Server ---------------------------------

runtime_info = ServerRuntimeInfo("http-compat/streamable-http")
# create_server returns (FastMCP, CustomRoutes) when custom_routes_handling='return'.
# The type annotation is a union, so unpack at runtime.
_created = create_server(config, runtime_info=runtime_info, custom_routes_handling="return")
assert isinstance(_created, tuple), "expected (FastMCP, CustomRoutes) tuple"
mcp_server, custom_routes = _created
mcp_http_app = mcp_server.http_app(
    path="/",
    transport="streamable-http",
    stateless_http=True,
)


@asynccontextmanager
async def lifespan(_app: Starlette) -> AsyncIterator[None]:
    """Forward the upstream MCP app's lifespan (DB pools, etc.)."""
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(mcp_http_app.lifespan(_app))
        yield


app = Starlette(
    middleware=[Middleware(ForwardSlashMiddleware)],
    lifespan=lifespan,
    routes=[
        Route("/healthz", _healthz, methods=["GET"]),
        Route("/.well-known/oauth-protected-resource", _protected_resource_metadata, methods=["GET"]),
        Route("/.well-known/oauth-authorization-server", _authorization_server_metadata, methods=["GET"]),
        Route("/register", _register, methods=["POST"]),
        Route("/authorize", _authorize, methods=["GET"]),
        Route("/token", _token, methods=["POST"]),
        Mount("/mcp", app=mcp_http_app),
    ],
)
custom_routes.add_to_starlette(app)
app.add_middleware(BearerAuthMiddleware)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5000")),
        log_level=os.environ.get("LOG_LEVEL", "info").lower(),
    )
```

- [ ] **Step 2: Create `template/pyproject.toml`** — pin bumped to `v1.73.1`, deps marked as swap point:

```toml
[project]
name = "mcp-data-app"
version = "0.1.0"
description = "Host an MCP server as a private, single-tenant Keboola data app with bearer + OAuth-shape auth."
readme = "README.md"
requires-python = ">=3.11"
license = { text = "MIT" }
authors = [{ name = "Keboola", email = "devel@keboola.com" }]
dependencies = [
    # ── SWAP POINT (deps): wrapping a different MCP server? Replace the
    # keboola-mcp-server line with your server's package (and pin a tag/SHA).
    # Keep fastmcp/mcp/starlette/uvicorn — the wrapper needs them.
    "keboola-mcp-server @ git+https://github.com/keboola/keboola-mcp-server.git@v1.73.1",
    "fastmcp>=3.2.0",
    "mcp>=1.27.0",
    "starlette>=0.46.0",
    "uvicorn[standard]>=0.30.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 3: Create `template/keboola-config/nginx/sites/default.conf`** (verbatim from the example — SSE-safe + Host-rewrite DNS-rebinding trick):

```nginx
# Nginx config for the mcp-data-app Keboola data app.
#
# Traffic flow:  Client → Keboola proxy → Nginx (port 8888) → server.py (port 5000)
#
# Critical settings:
#   - `proxy_buffering off` on /mcp: required for MCP streamable-HTTP (SSE).
#   - `/` returns 200 directly: handles Keboola's GET (startup probe) and
#     POST (wakeup check) without involving the app.
#   - `Host: 127.0.0.1:5000` is rewritten for every proxied location: the
#     MCP SDK has DNS-rebinding protection that 421s any Host outside its
#     allowlist (localhost variants by default). Original host preserved
#     via X-Forwarded-Host.
#   - Five OAuth-shape stubs are also proxied so Claude Desktop's "Add
#     custom connector" GUI flow works; see server.py for the rationale.

server {
    listen 8888;
    server_name _;

    # Keboola startup probe (GET) and wakeup probe (POST). Answered by
    # Nginx directly so it works even if server.py is still booting.
    location = / {
        default_type application/json;
        return 200 '{"status":"ok","service":"keboola-mcp-data-app"}';
    }

    # MCP endpoint. Streaming-safe; app handles bearer auth.
    location /mcp {
        proxy_pass http://127.0.0.1:5000/mcp;
        proxy_set_header Host "127.0.0.1:5000";
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;

        # Required for MCP streamable-http (SSE).
        proxy_buffering off;
        proxy_cache off;
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        # MCP tool calls can take a while (Keboola API + network).
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }

    location = /healthz {
        proxy_pass http://127.0.0.1:5000/healthz;
        proxy_set_header Host "127.0.0.1:5000";
        proxy_set_header X-Forwarded-Host $host;
    }

    # OAuth-shape stubs — let Claude Desktop's GUI custom-connector flow run
    # through discovery + authorize + token without hitting bearer auth.
    # All share the Host-rewrite trick for the MCP SDK's DNS-rebinding
    # protection. None of these stream, so default buffering is fine.
    location = /.well-known/oauth-protected-resource {
        proxy_pass http://127.0.0.1:5000/.well-known/oauth-protected-resource;
        proxy_set_header Host "127.0.0.1:5000";
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location = /.well-known/oauth-authorization-server {
        proxy_pass http://127.0.0.1:5000/.well-known/oauth-authorization-server;
        proxy_set_header Host "127.0.0.1:5000";
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location = /register {
        proxy_pass http://127.0.0.1:5000/register;
        proxy_set_header Host "127.0.0.1:5000";
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location = /authorize {
        proxy_pass http://127.0.0.1:5000/authorize$is_args$args;
        proxy_set_header Host "127.0.0.1:5000";
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location = /token {
        proxy_pass http://127.0.0.1:5000/token;
        proxy_set_header Host "127.0.0.1:5000";
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Pass through Basic auth header (client_secret_basic).
        proxy_set_header Authorization $http_authorization;
    }
}
```

- [ ] **Step 4: Create `template/keboola-config/supervisord/services/mcp-server.conf`** (verbatim):

```ini
[program:mcp-server]
command=uv run python /app/server.py
directory=/app
autostart=true
autorestart=true
startretries=3
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=PORT="5000"
```

- [ ] **Step 5: Create `template/keboola-config/setup.sh`** (verbatim):

```bash
#!/bin/bash
# Dependency install for the Keboola data app. Run once at container startup
# by the Keboola data app runtime — Supervisord then starts server.py.
set -Eeuo pipefail

cd /app
uv sync
```

- [ ] **Step 6: Create `template/.gitignore`**:

```gitignore
# Secrets
.env
.env.local

# Python
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
.venv/
venv/
.eggs/
build/
dist/

# uv
.uv-cache/

# IDE / OS
.DS_Store
.idea/
.vscode/
*.swp
```

- [ ] **Step 7: Verify the Python file compiles and shell file is valid**

Run:
```bash
python -m py_compile plugins/dataapp-developer/skills/mcp-data-app/template/server.py && echo "server.py OK"
bash -n plugins/dataapp-developer/skills/mcp-data-app/template/keboola-config/setup.sh && echo "setup.sh OK"
```
Expected: `server.py OK` and `setup.sh OK` (no syntax errors). Note: `py_compile` only checks syntax; it does not import `keboola_mcp_server`.

- [ ] **Step 8: Verify the tree is complete**

Run:
```bash
find plugins/dataapp-developer/skills/mcp-data-app/template -type f | sort
```
Expected exactly:
```
plugins/dataapp-developer/skills/mcp-data-app/template/.gitignore
plugins/dataapp-developer/skills/mcp-data-app/template/keboola-config/nginx/sites/default.conf
plugins/dataapp-developer/skills/mcp-data-app/template/keboola-config/setup.sh
plugins/dataapp-developer/skills/mcp-data-app/template/keboola-config/supervisord/services/mcp-server.conf
plugins/dataapp-developer/skills/mcp-data-app/template/pyproject.toml
plugins/dataapp-developer/skills/mcp-data-app/template/server.py
```

- [ ] **Step 9: Commit**

```bash
git add plugins/dataapp-developer/skills/mcp-data-app/template
git commit -m "feat(mcp-data-app): bundle Keboola-MCP data-app template"
```

---

## Task 2: Scaffold helper (`scripts/scaffold.sh`)

**Files:**
- Create: `plugins/dataapp-developer/skills/mcp-data-app/scripts/scaffold.sh`
- Test: ad-hoc shell assertions into a scratch dir (shown below; no test file committed)

**Interfaces:**
- Consumes: `template/` from Task 1 (via `$SKILL_DIR/template`).
- Produces: `scaffold.sh [--force] [TARGET_DIR]` — copies the template tree (including dotfiles) into `TARGET_DIR` (default `./mcp-data-app`), makes `keboola-config/setup.sh` executable, prints next steps. Exits non-zero if the target is non-empty without `--force`, or if the template dir is missing.

- [ ] **Step 1: Write the scaffold script**

Create `plugins/dataapp-developer/skills/mcp-data-app/scripts/scaffold.sh`:

```bash
#!/usr/bin/env bash
# Scaffold an MCP-server Keboola data app from the bundled template.
#
# Run from your PROJECT ROOT (not the skill dir):
#   bash <skill>/scripts/scaffold.sh [--force] [TARGET_DIR]
#
# TARGET_DIR defaults to ./mcp-data-app. Copies the template tree, makes
# setup.sh executable, and prints next steps. Refuses to clobber a non-empty
# target unless --force is given.
set -Eeuo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$SKILL_DIR/template"

FORCE=0
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) TARGET="$arg" ;;
  esac
done
TARGET="${TARGET:-./mcp-data-app}"

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "ERROR: template dir not found at $TEMPLATE_DIR" >&2
  exit 1
fi

if [[ -d "$TARGET" && -n "$(ls -A "$TARGET" 2>/dev/null)" && "$FORCE" -ne 1 ]]; then
  echo "ERROR: target '$TARGET' exists and is not empty. Use --force to overwrite." >&2
  exit 1
fi

mkdir -p "$TARGET"
cp -R "$TEMPLATE_DIR"/. "$TARGET"/
chmod +x "$TARGET/keboola-config/setup.sh"

echo "Scaffolded MCP data app into: $TARGET"
echo
echo "Next steps:"
echo "  1. Wrapping a non-Keboola MCP server? Edit the swap points in server.py"
echo "     and pyproject.toml (see reference/adapting-to-any-server.md)."
echo "  2. Set data-app secrets: #KBC_STORAGE_API_URL, #KBC_STORAGE_TOKEN,"
echo "     #MCP_API_KEY (openssl rand -hex 32); set #MCP_PUBLIC_URL after first deploy."
echo "  3. Commit + push to the app's git repo, then deploy (see reference/deploy.md)."
```

- [ ] **Step 2: Make it executable**

Run:
```bash
chmod +x plugins/dataapp-developer/skills/mcp-data-app/scripts/scaffold.sh
```

- [ ] **Step 3: Test — happy path produces the full tree with executable setup.sh**

Run:
```bash
rm -rf /tmp/mcpda_test && mkdir -p /tmp/mcpda_test
bash plugins/dataapp-developer/skills/mcp-data-app/scripts/scaffold.sh /tmp/mcpda_test/out
find /tmp/mcpda_test/out -type f | sort
test -x /tmp/mcpda_test/out/keboola-config/setup.sh && echo "setup.sh executable OK"
test -f /tmp/mcpda_test/out/.gitignore && echo "dotfiles copied OK"
```
Expected: the six template files listed under `/tmp/mcpda_test/out/…`, `setup.sh executable OK`, `dotfiles copied OK`.

- [ ] **Step 4: Test — refuses a non-empty target without `--force`, allows with it**

Run:
```bash
bash plugins/dataapp-developer/skills/mcp-data-app/scripts/scaffold.sh /tmp/mcpda_test/out; echo "exit=$?"
bash plugins/dataapp-developer/skills/mcp-data-app/scripts/scaffold.sh --force /tmp/mcpda_test/out; echo "force_exit=$?"
```
Expected: first call prints the "exists and is not empty" error with `exit=1`; second prints "Scaffolded …" with `force_exit=0`.

- [ ] **Step 5: Commit**

```bash
git add plugins/dataapp-developer/skills/mcp-data-app/scripts/scaffold.sh
git commit -m "feat(mcp-data-app): add scaffold.sh template copier"
```

---

## Task 3: `reference/deploy.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/mcp-data-app/reference/deploy.md`

**Interfaces:**
- Produces: the deploy-path reference the SKILL.md spine (Task 6) routes to for steps 4–5. Named sections other files link to: "Pick a driver", "Secrets", "Two-pass MCP_PUBLIC_URL", "Verify".

- [ ] **Step 1: Write the file** with these sections and the exact embedded blocks:

1. **Header + when-to-use.** `# Deploy` and one line: use this to push the scaffolded app to git and deploy it as a Keboola data app.

2. **Prerequisite decision (verbatim):**
   > An MCP data app is a **Python/JS** app: it deploys from **git**, not via the Streamlit `deploy_data_app`/`modify_streamlit_data_app` code path. Detect available drivers at session start and **pick one — don't mix** (see `dataapp-development/references/deployment-paths.md`).

3. **Pick a driver** table:

   | You have… | Driver | Mechanics live in |
   |---|---|---|
   | `kbagent` on PATH | kbagent CLI / keboola-git managed repo | `keboola-git` skill; `deployment-paths.md` Path C |
   | Hosted Keboola MCP tools (Kai, or Claude + hosted MCP) | MCP data-app tools | this file, §MCP-tools driver |
   | Neither | Manual Keboola UI | this file, §Manual UI |

4. **§keboola-git / kbagent driver** — cross-reference `keboola-git` skill; the minimal sequence (embed verbatim):
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

5. **§MCP-tools driver (Kai / hosted MCP)** — same three tools, called directly as MCP tools rather than via `kbagent … tool call`:
   - `modify_python_js_data_app(name, slug, description)` → returns `configuration_id`, `data_app_id`, `repo_url`.
   - `create_python_js_data_app_git_credential(configuration_id)` → returns `git_clone_url` (contains a one-time secret; keep in a variable, never commit/echo).
   - `git push` the scaffolded tree to that URL (a git-capable runner is still required).
   - `deploy_data_app(action="deploy", configuration_id=...)`.
   State the live-vs-placeholder note verbatim: "`deployment-paths.md` still calls this a placeholder; the tools are live today. Treat this path as real."

6. **§Manual UI** — numbered steps: Apps → Create App → Python/JS Data App; point at repo URL + branch; add the four secrets; **App-level auth = No auth**; auto-suspend ≥ 24h; Deploy; copy URL; set `#MCP_PUBLIC_URL`; redeploy.

7. **§Secrets** — the required/optional table (copy names verbatim from Global Constraints; generate `#MCP_API_KEY` with `openssl rand -hex 32`). Via kbagent: `kbagent --allow-env-manage-token data-app secrets-set --project <alias> --app-id <id> '#KEY=VAL'` then redeploy.

8. **§App-level auth = None (critical)** — verbatim: "Set the data app's built-in authentication to **None**. Keboola's app-level OIDC strips the `Authorization` header before it reaches the container, breaking both the bearer and OAuth-shape flows. `#MCP_API_KEY` is the security boundary. See `dataapp-development/references/authentication.md` (the 'None — implement your own auth in code' option)."

9. **§Two-pass MCP_PUBLIC_URL** — verbatim: deploy with `#MCP_PUBLIC_URL` empty → copy the app URL Keboola shows (`https://<slug>-<cfg>.hub.<region>.keboola.com`, no trailing slash, no `/mcp`) → set `#MCP_PUBLIC_URL` → redeploy so the OAuth-shape discovery docs advertise the real origin.

10. **§Verify** — logs first (authoritative): look for `success: mcp-server entered RUNNING state` in the deploy logs (via `kbagent … data-app logs` or the Keboola Terminal Log tab). Then:
    ```bash
    curl -sS https://<app-url>/healthz
    curl -sS https://<app-url>/.well-known/oauth-protected-resource
    curl -sS -i https://<app-url>/mcp | head -5   # expect 401 + WWW-Authenticate
    ```
    The discovery JSON must show `MCP_PUBLIC_URL`, not `127.0.0.1:5000`; if it shows localhost, `#MCP_PUBLIC_URL` wasn't set — fix and redeploy.

- [ ] **Step 2: Verify links resolve**

Run:
```bash
grep -o 'reference/[a-z-]*\.md\|dataapp-development/references/[a-z-]*\.md\|keboola-git' plugins/dataapp-developer/skills/mcp-data-app/reference/deploy.md | sort -u
```
Expected: only references that exist (`authentication.md`, `deployment-paths.md`, `keboola-git`) — no typos.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/mcp-data-app/reference/deploy.md
git commit -m "docs(mcp-data-app): add deploy reference (kbagent/keboola-git/Kai/manual)"
```

---

## Task 4: `reference/auth-and-clients.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/mcp-data-app/reference/auth-and-clients.md`

**Interfaces:**
- Produces: the auth+clients reference SKILL.md routes to for step 6. Named sections: "How the server-side auth works", "Connect a client".

- [ ] **Step 1: Write the file** with these sections and exact blocks:

1. **`# Auth & clients`** + one-line purpose.

2. **§How the server-side auth works** — prose + the ASCII diagram (verbatim from the example README) showing Client → Nginx :8888 → server.py :5000, `BearerAuthMiddleware` on all paths except `ANON_PATHS`, `Mount("/mcp", …)`. Explain: `/token` is the real gate (`client_secret == MCP_API_KEY`, returns `MCP_API_KEY` as `access_token`); OAuth-shape endpoints are stubs; net security profile == static bearer. Rotation = bump `#MCP_API_KEY`, redeploy, re-paste in clients.

   ```
                               ┌──────────────────────────────────────┐
                               │  Keboola data-app container           │
    Claude client ─ HTTPS ──▶  │ Nginx :8888 ──▶ server.py :5000        │
                               │   BearerAuthMiddleware (all paths      │
                               │   except ANON_PATHS: /healthz,         │
                               │   /.well-known/oauth-*, /register,     │
                               │   /authorize, /token)                  │
                               │        └──▶ Mount("/mcp", upstream)    │
                               └────────────────────────────────────────┘
   ```

3. **§Connect a client — Pattern A: static bearer** — embed the `mcp-remote` JSON verbatim:
   ```json
   {
     "mcpServers": {
       "keboola": {
         "command": "npx",
         "args": ["-y", "mcp-remote@latest", "https://<app-url>/mcp",
                  "--header", "Authorization:Bearer ${MCP_API_KEY}"],
         "env": { "MCP_API_KEY": "<paste-MCP_API_KEY>" }
       }
     }
   }
   ```
   Note: for an Anthropic Managed Agent, pick "Static bearer token" in the credential vault and paste `MCP_API_KEY`.

4. **§Connect a client — Pattern B: claude.ai "Add custom connector" (OAuth-shape)** — numbered: Add custom connector → Remote MCP URL `https://<app-url>/mcp`; Advanced settings → OAuth Client ID = any non-empty string (e.g. `claude`), OAuth Client Secret = the `MCP_API_KEY`; Add → the `/authorize` tab flashes and closes; tools list. Smoke test with the three `curl`s from `deploy.md §Verify`.

5. **§Connect a client — Pattern C: Kai** — verbatim: "The deployed endpoint is an ordinary remote MCP server, so Kai (the Keboola AI Assistant) consumes it with the same credential — bearer for programmatic use, or the OAuth-shape flow via a custom-connector UI. **Note:** the exact 'add a custom MCP connector to Kai' UX is not yet confirmed; the auth contract (endpoint URL + `MCP_API_KEY`) is settled. If Kai does not yet expose custom connectors, use Pattern A from any Kai-adjacent agent that accepts an MCP endpoint + bearer header."

- [ ] **Step 2: Commit**

```bash
git add plugins/dataapp-developer/skills/mcp-data-app/reference/auth-and-clients.md
git commit -m "docs(mcp-data-app): add auth-and-clients reference"
```

---

## Task 5: `reference/adapting-to-any-server.md` + `reference/troubleshooting.md`

**Files:**
- Create: `plugins/dataapp-developer/skills/mcp-data-app/reference/adapting-to-any-server.md`
- Create: `plugins/dataapp-developer/skills/mcp-data-app/reference/troubleshooting.md`

**Interfaces:**
- Produces: the two remaining references SKILL.md routes to (step 1 → adapting; troubleshooting on failure).

- [ ] **Step 1: Write `adapting-to-any-server.md`** with:

1. **`# Adapting to any MCP server`** + one-liner: the template ships the Keboola baseline; here's what to change for a different server.

2. **§The two swap points.** Point at the `# ── SWAP POINT` banners in `server.py` (imports + mount block) and `pyproject.toml` (deps). Show the generic replacement for the mount block verbatim:
   ```python
   # Generic FastMCP server: import your server's FastMCP instance and build its HTTP app.
   from my_mcp_server import mcp  # your FastMCP() instance
   mcp_http_app = mcp.http_app(path="/", transport="streamable-http", stateless_http=True)
   # Then in the Starlette routes, keep: Mount("/mcp", app=mcp_http_app)
   # Drop the Keboola-only bits: Config.from_dict(...), ServerRuntimeInfo,
   # create_server(...), custom_routes, and the KBC_* env checks.
   ```
   And the deps swap: replace the `keboola-mcp-server @ …` line with your package; keep `fastmcp`/`mcp`/`starlette`/`uvicorn`. Note the auth wrapper, nginx, supervisord, setup.sh are unchanged.

3. **§Variant: stdio-only servers (bridge).** Verbatim guidance: many MCP servers (esp. Node packages) speak **stdio**, not HTTP — they can't be mounted. Front them with a stdio→HTTP bridge (`supergateway` or `mcp-proxy`) run under supervisord, then point nginx `/mcp` at the bridge's port. Sketch a supervisord entry:
   ```ini
   [program:mcp-bridge]
   command=npx -y supergateway --stdio "npx -y @some/mcp-server" --port 5000
   directory=/app
   autostart=true
   autorestart=true
   stdout_logfile=/dev/stdout
   stdout_logfile_maxbytes=0
   stderr_logfile=/dev/stderr
   stderr_logfile_maxbytes=0
   ```
   Note: with a bridge, `server.py`'s FastMCP mount is not used; keep the bearer/OAuth-shape auth by fronting the bridge with the same Starlette wrapper OR enforce auth in nginx. Mark the exact wiring as an exercise; the pattern is: bridge the transport, keep the auth boundary. (v1 documents the pattern; a full stdio template is a non-goal.)

- [ ] **Step 2: Write `troubleshooting.md`** — a symptom → cause → fix table with these MCP-specific rows (each verbatim):

   | Symptom | Cause | Fix |
   |---|---|---|
   | `421 Misdirected Request` on `/mcp` | MCP SDK DNS-rebinding protection rejects the Host header | Ensure nginx sends `proxy_set_header Host "127.0.0.1:5000";` on every proxied location (see template nginx conf) |
   | Client sees the whole SSE response at once / hangs | nginx buffering the stream | `proxy_buffering off; proxy_cache off;` on `location /mcp` (already in template) |
   | Discovery JSON shows `127.0.0.1:5000` instead of the real host | `#MCP_PUBLIC_URL` not set | Set `#MCP_PUBLIC_URL` to the app origin and redeploy (two-pass dance) |
   | All `/mcp` calls 401 even with the right key, connector never prompts for creds | App-level OIDC stripped `Authorization` | Set app-level auth to **None**; `#MCP_API_KEY` is the boundary |
   | `KeyError: 'MCP_API_KEY'` / `SystemExit: Missing required env vars` at boot | Secrets not set | Add `#MCP_API_KEY`, `#KBC_STORAGE_API_URL`, `#KBC_STORAGE_TOKEN` as data-app secrets |
   | claude.ai connector fails at the OAuth step | discovery endpoints unreachable or Host-rewrite missing | Confirm the five OAuth-shape locations are proxied with the Host rewrite; `curl` the two `.well-known/oauth-*` docs |
   | Container restart loop | `setup.sh` failed or `uv sync` error | Check the Terminal Log; ensure `pyproject.toml` resolves and the upstream pin exists |

   Add a pointer line: for generic container issues (POST `/`, `uv`/PEP 668, `[program:nginx]`) see `dataapp-development/references/python-js-apps.md` and `.../troubleshooting.md`.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/mcp-data-app/reference/adapting-to-any-server.md \
        plugins/dataapp-developer/skills/mcp-data-app/reference/troubleshooting.md
git commit -m "docs(mcp-data-app): add adapting + troubleshooting references"
```

---

## Task 6: `SKILL.md` (the spine)

**Files:**
- Create: `plugins/dataapp-developer/skills/mcp-data-app/SKILL.md`

**Interfaces:**
- Consumes: all four references (Tasks 3–5), the `template/` (Task 1), and `scripts/scaffold.sh` (Task 2) — all now exist.
- Produces: the entry point Claude loads. Frontmatter `name: mcp-data-app` + a rich trigger `description`.

- [ ] **Step 1: Write `SKILL.md`** with this exact frontmatter and body structure:

```markdown
---
name: mcp-data-app
description: >-
  Use this skill to host an MCP server as a private, single-tenant Keboola
  data app — a dedicated remote MCP endpoint on your own Keboola compute that
  Claude Desktop, claude.ai, Cursor, Kai, and other MCP clients connect to.
  Scaffolds a Starlette wrapper (static-bearer + OAuth-shape client auth) around
  any streamable-HTTP / FastMCP server, ships the keboola-config/ trio
  (nginx + supervisord + setup.sh), then deploys via kbagent, keboola-git
  managed repos, or the hosted Keboola MCP tools, with a manual Keboola UI
  fallback. Keboola MCP server is the built-in worked example.
  Use for: host MCP server as data app, self-host Keboola MCP, remote MCP
  endpoint, private MCP server, bearer/OAuth MCP connector, deploy MCP server
  to Keboola, wrap an MCP server. Trigger when the user wants their own hosted
  MCP endpoint running as a Keboola data app.
---

# mcp-data-app — Host an MCP server as a Keboola data app

Scaffold → secrets → git → deploy → verify → connect. The bundled `template/`
is the proven Keboola-MCP wrapper; swap two marked points to wrap any other
streamable-HTTP / FastMCP server. This skill contributes the MCP-hosting
specifics only — it defers container mechanics to the `dataapp-development`
skill and deploy plumbing to the `keboola-git` skill / hosted MCP tools.

## Working Directory Context

Scripts run from the **user's project root**, never from this skill directory.
`scripts/scaffold.sh` self-detects its own location to find `template/`; you
pass it the target directory in the user's project. Do all git work in the
user's repo.

## Workflow

1. **Choose the MCP server** — Keboola MCP (default) → use the template as-is.
   Another FastMCP/HTTP server → apply the swap points. A stdio-only server →
   `reference/adapting-to-any-server.md` (bridge variant).
2. **Scaffold** — `bash <skill>/scripts/scaffold.sh <target-dir>` (or copy
   `template/`). Apply swap points for non-Keboola servers.
3. **Configure secrets** — `#KBC_STORAGE_API_URL`, `#KBC_STORAGE_TOKEN`,
   `#MCP_API_KEY` (`openssl rand -hex 32`); `#MCP_PUBLIC_URL` after first deploy.
   Details + optional vars in `reference/deploy.md §Secrets`.
4. **Push to git & deploy** — pick ONE driver (kbagent / keboola-git / hosted
   MCP tools incl. Kai / manual UI). App-level auth = **None**; auto-suspend
   ≥ 24h; run the two-pass `#MCP_PUBLIC_URL` dance. See `reference/deploy.md`.
5. **Verify** — logs first, then `curl /healthz`, the two `.well-known/oauth-*`
   docs, and `401` on `/mcp`. See `reference/deploy.md §Verify`.
6. **Connect a client** — bearer, claude.ai OAuth-shape, or Kai. See
   `reference/auth-and-clients.md`.

## References

| Need | Read |
|---|---|
| Deploy paths, secrets, MCP_PUBLIC_URL, verify | `reference/deploy.md` |
| How the auth works + connect recipes (incl. Kai) | `reference/auth-and-clients.md` |
| Wrap a non-Keboola server / stdio bridge | `reference/adapting-to-any-server.md` |
| MCP-specific errors (421, SSE, discovery) | `reference/troubleshooting.md` |
| Container mechanics (POST /, uv, nginx 8888) | `dataapp-development/references/python-js-apps.md` |
| Managed-git deploy plumbing | `keboola-git` skill |

## Hard rules

1. App-level auth MUST be **None** — platform OIDC strips `Authorization`.
2. Never commit the git push credential or `#MCP_API_KEY` — keep secrets in the
   data-app config, not in code.
3. Pick ONE deploy driver per session; don't mix (branches/projects diverge).
4. Push source only — `uv sync` installs at deploy; no build artifacts in git.
```

- [ ] **Step 2: Verify frontmatter parses and references exist**

Run:
```bash
head -20 plugins/dataapp-developer/skills/mcp-data-app/SKILL.md
for f in deploy auth-and-clients adapting-to-any-server troubleshooting; do
  test -f "plugins/dataapp-developer/skills/mcp-data-app/reference/$f.md" && echo "$f.md OK"
done
test -f plugins/dataapp-developer/skills/mcp-data-app/scripts/scaffold.sh && echo "scaffold OK"
```
Expected: frontmatter shows `name: mcp-data-app`; all four `*.md OK` lines; `scaffold OK`.

- [ ] **Step 3: Commit**

```bash
git add plugins/dataapp-developer/skills/mcp-data-app/SKILL.md
git commit -m "feat(mcp-data-app): add SKILL.md spine + trigger description"
```

---

## Task 7: Housekeeping — versions, READMEs, validation

**Files:**
- Modify: `plugins/dataapp-developer/.claude-plugin/plugin.json` (version + description)
- Modify: `.claude-plugin/marketplace.json` (dataapp-developer entry version + description)
- Modify: `plugins/dataapp-developer/README.md` (document the new skill)
- Modify: `README.md` (root — plugin feature list)

**Interfaces:**
- Consumes: the completed skill (Tasks 1–6).
- Produces: a marketplace-consistent, validated plugin.

- [ ] **Step 1: Bump `plugins/dataapp-developer/.claude-plugin/plugin.json`**

Change `"version": "1.3.0"` → `"version": "1.4.0"`. Append to the description string (before the closing quote): `; and hosting an MCP server as a data app`.

- [ ] **Step 2: Bump the entry in `.claude-plugin/marketplace.json`**

In the `dataapp-developer` plugin object, change `"version": "1.3.0"` → `"version": "1.4.0"` and mirror the same description suffix so the two stay in sync.

- [ ] **Step 3: Document the skill in `plugins/dataapp-developer/README.md`**

Add a short "MCP data app" subsection to the skills list following the file's existing formatting (match the heading level and bullet style already used for `dataapp-development`). Content to convey: what it does (host any MCP server as a single-tenant Keboola data app), the built-in Keboola-MCP example, the two client-auth patterns, and the four deploy drivers. Include a one-line pointer to `skills/mcp-data-app/SKILL.md`.

- [ ] **Step 4: Update the root `README.md` feature list**

In the Data App Developer plugin's Features list, add a bullet: `🔌 **MCP hosting**: host any MCP server (Keboola MCP as the worked example) as a single-tenant data app — bearer + OAuth-shape auth, deploy via kbagent / keboola-git / hosted MCP tools`.

- [ ] **Step 5: Validate the plugin**

Run:
```bash
claude plugin validate .
```
Expected: validation passes (no errors) for the marketplace and the `dataapp-developer` plugin. If `claude` is unavailable, fall back to JSON syntax checks:
```bash
python -m json.tool plugins/dataapp-developer/.claude-plugin/plugin.json >/dev/null && echo "plugin.json OK"
python -m json.tool .claude-plugin/marketplace.json >/dev/null && echo "marketplace.json OK"
```
Expected: both `OK`.

- [ ] **Step 6: Full skill tree sanity check**

Run:
```bash
find plugins/dataapp-developer/skills/mcp-data-app -type f | sort
```
Expected (11 files): SKILL.md; reference/{deploy,auth-and-clients,adapting-to-any-server,troubleshooting}.md; scripts/scaffold.sh; template/{server.py,pyproject.toml,.gitignore}; template/keboola-config/{setup.sh,nginx/sites/default.conf,supervisord/services/mcp-server.conf}.

- [ ] **Step 7: Commit**

```bash
git add plugins/dataapp-developer/.claude-plugin/plugin.json .claude-plugin/marketplace.json \
        plugins/dataapp-developer/README.md README.md
git commit -m "chore(mcp-data-app): bump dataapp-developer 1.3.0->1.4.0, docs + marketplace"
```

---

## Self-Review

**1. Spec coverage:**
- Any-server scope → Task 1 swap points + Task 5 adapting doc. ✓
- New sibling skill placement → Tasks 1–6 under `skills/mcp-data-app/`. ✓
- Bundled template → Task 1. ✓
- Deploy: kbagent/keboola-git/Kai-MCP/manual → Task 3. ✓
- Kai as deploy driver + as client → Task 3 §MCP-tools driver + Task 4 §Pattern C. ✓
- HTTP/FastMCP primary + stdio bridge note → Task 5. ✓
- App-level None auth, two-pass MCP_PUBLIC_URL → Task 3 + Task 6 hard rules. ✓
- Auth patterns (bearer + OAuth-shape) → Task 1 (code) + Task 4 (docs). ✓
- Scaffold script (SCRIPT_DIR, project-root) → Task 2 + Task 6 Working Directory Context. ✓
- Housekeeping (versions/READMEs) → Task 7. ✓
- Non-goals respected (no deployment-paths.md edit, no stale-xref fix, no kai-client UI) → not present in any task. ✓
- "Verify during implementation" items: upstream pin resolved to v1.73.1 (Task 1); Kai connector UX flagged in Task 4 §Pattern C; MCP-tools argument shape to confirm at Task 3 execution. ✓

**2. Placeholder scan:** No "TBD/TODO/handle edge cases". The stdio-bridge "exercise" note is a scoped v1 non-goal, not a plan gap. Every code/config file has complete content; every doc task embeds its exact technical blocks.

**3. Type/name consistency:** File paths, secret names (`#KBC_STORAGE_API_URL`, `#KBC_STORAGE_TOKEN`, `#MCP_API_KEY`, `#MCP_PUBLIC_URL`), tool names (`modify_python_js_data_app`, `create_python_js_data_app_git_credential`, `deploy_data_app`), and the four reference filenames match across Tasks 1–7 and the SKILL.md references table.
