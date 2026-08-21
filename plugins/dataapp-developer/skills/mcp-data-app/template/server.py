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
    MCP_PUBLIC_URL          Override for this app's externally reachable
                            origin, no trailing slash, no `/mcp`. Normally
                            leave unset: on Keboola the platform injects
                            KBC_APP_PUBLIC_URL with the app's own URL, which
                            is used automatically. Set this only when the app
                            is reached at a different origin (custom domain,
                            reverse proxy). Falls back to
                            http://localhost:5000 for local dev.
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
# Origin advertised by the OAuth-shape discovery documents. Keboola injects
# KBC_APP_PUBLIC_URL with the app's own public URL, so no manual configuration
# is needed on the platform. MCP_PUBLIC_URL remains an explicit override for an
# app reached at a different origin (custom domain, reverse proxy).
MCP_PUBLIC_URL = (
    os.environ.get("MCP_PUBLIC_URL")
    or os.environ.get("KBC_APP_PUBLIC_URL")
    or "http://localhost:5000"
).rstrip("/")

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
