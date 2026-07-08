# Auth & clients

**Use this when:** you need to understand how `server.py`'s auth model works, or connect a client (an `mcp-remote`-based agent, claude.ai, Kai) to a deployed MCP data app.

## How the server-side auth works

Every request to the data app passes through Nginx before it reaches `server.py`. `server.py` wraps the upstream Keboola MCP server with a Starlette `BearerAuthMiddleware` that runs on **every path** except a small `ANON_PATHS` allowlist, then mounts the MCP app itself at `/mcp`:

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

`ANON_PATHS` exists so the platform health probe and the OAuth-shape discovery/handshake endpoints work before a client has a token. Everything else — including `/mcp` — requires `Authorization: Bearer $MCP_API_KEY`.

The five extra endpoints (`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/register`, `/authorize`, `/token`) impersonate an OAuth 2.1 authorization server closely enough that claude.ai's "Add custom connector" GUI completes its flow. They are **stubs**, not a real AS:

- `/register` always succeeds and hands back a static `client_id`.
- `/authorize` always issues a code and redirects — it never prompts for credentials or consent.
- **`/token` is the real gate.** It requires `client_secret == MCP_API_KEY` (posted as a form field or HTTP Basic) and, on success, returns `MCP_API_KEY` itself as the `access_token`. That token is exactly what `BearerAuthMiddleware` expects on `/mcp`.

Net effect: the OAuth-shape flow is cosmetic. It gives clients a GUI to paste a secret into, but the security profile is identical to handing that same client a static bearer token — one shared key gates the server either way.

**Rotation:** bump `#MCP_API_KEY` (generate a new value, e.g. `openssl rand -hex 32`), redeploy the data app, then re-paste the new value into every connected client (the `mcp-remote` config's `env.MCP_API_KEY`, or the OAuth Client Secret field in claude.ai). There is no way to rotate one client's credential without rotating all of them — they all share the same key.

## Connect a client

All three patterns below authenticate against the same two facts: the app's `/mcp` URL and the `MCP_API_KEY` secret. Pick the pattern that matches the client's UI.

### Pattern A: static bearer (`mcp-remote`)

For any client that runs `mcp-remote` (e.g. Claude Desktop's `claude_desktop_config.json`), embed:

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

### Pattern B: claude.ai "Add custom connector" (OAuth-shape)

1. Add custom connector.
2. Remote MCP URL: `https://<app-url>/mcp`.
3. Advanced settings → OAuth Client ID: any non-empty string (e.g. `claude`); OAuth Client Secret: the `MCP_API_KEY` value.
4. Add — the `/authorize` tab flashes and closes, then the tools list appears.

Smoke test with the three `curl`s from `deploy.md` §Verify.

### Pattern C: Kai

The deployed endpoint is an ordinary remote MCP server, so Kai (the Keboola AI Assistant) consumes it with the same credential — bearer for programmatic use, or the OAuth-shape flow via a custom-connector UI. **Note:** the exact 'add a custom MCP connector to Kai' UX is not yet confirmed; the auth contract (endpoint URL + `MCP_API_KEY`) is settled. If Kai does not yet expose custom connectors, use Pattern A from any Kai-adjacent agent that accepts an MCP endpoint + bearer header.
