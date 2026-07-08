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
