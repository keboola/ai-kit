# Adapting to any MCP server

**Use this when:** you want to wrap a different MCP server instead of the bundled one. The template ships the Keboola baseline; this file covers what to change for a different server.

## The two swap points

The template marks exactly two spots as safe to change, each tagged with a `# ── SWAP POINT` comment. Everything else — the Starlette app, `BearerAuthMiddleware`, the OAuth-shape stub endpoints, nginx, supervisord, `setup.sh` — is server-agnostic and stays as-is.

### `server.py` — imports

Find the `# ── SWAP POINT (imports)` comment near the top of `server.py`. It marks the three `keboola_mcp_server` imports. Replace them with whatever your target server exposes — most FastMCP-based servers expose a single `FastMCP()` instance you import directly, used in the mount-block replacement below.

### `server.py` — mount block

Find the `# ── SWAP POINT (mount)` comment above the block that builds `mcp_http_app` from `create_server(...)`. Replace that block with the generic FastMCP pattern:

```python
# Generic FastMCP server: import your server's FastMCP instance and build its HTTP app.
from my_mcp_server import mcp  # your FastMCP() instance
mcp_http_app = mcp.http_app(path="/", transport="streamable-http", stateless_http=True)
# Then in the Starlette routes, keep: Mount("/mcp", app=mcp_http_app)
# Drop the Keboola-only bits: Config.from_dict(...), ServerRuntimeInfo,
# create_server(...), custom_routes, and the KBC_* env checks.
```

Keep the `lifespan` context manager, the `Mount("/mcp", app=mcp_http_app)` route, `BearerAuthMiddleware`, and the five OAuth-shape stub routes untouched — `mcp_http_app.lifespan(_app)` works for any FastMCP instance, and the auth layer gates `/mcp` regardless of what's mounted there.

### `pyproject.toml` — deps

Find the `# ── SWAP POINT (deps)` comment in the `dependencies` array. Replace the `keboola-mcp-server @ …` line with your server's package (pin a version/tag/SHA the same way). Keep `fastmcp`, `mcp`, `starlette`, and `uvicorn` — the wrapper needs them regardless of which MCP server they wrap.

### What's unchanged

The auth wrapper, nginx config, supervisord config, and `setup.sh` don't reference the Keboola MCP server at all — they operate on `/mcp` as a generic mount point and on `PORT`/`MCP_API_KEY`/`MCP_PUBLIC_URL` as generic env vars. Leave them alone.

## Variant: stdio-only servers (bridge)

Many MCP servers — especially ones distributed as Node packages — speak **stdio**, not HTTP. A stdio server has no ASGI app to import, so it can't be mounted with `Mount("/mcp", app=...)` the way the swap above assumes.

Front it with a stdio→HTTP bridge instead: a small process that speaks stdio to the MCP server on one side and Streamable-HTTP (or SSE) on the other. Two common bridges: `supergateway` and `mcp-proxy`. Run the bridge as its own supervisord program:

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

Then point nginx's `/mcp` location at the bridge's port instead of `server.py`'s.

With a bridge in place, `server.py`'s FastMCP mount is not used — there's no Python FastMCP app to build `mcp_http_app` from. To keep the same bearer/OAuth-shape auth boundary, either front the bridge with the same Starlette wrapper (reverse-proxy `server.py`'s auth middleware in front of the bridge's port instead of mounting `mcp_http_app` directly), or enforce auth in nginx.

The exact wiring is left as an exercise — it depends on whether the bridge you pick passes an `Authorization` header through untouched. The pattern to keep is simple: **bridge the transport, keep the auth boundary.** v1 documents this pattern; a full stdio-fronting template is a non-goal.
