---
name: mcp-data-app
description: >-
  Host an MCP server as a private, single-tenant Keboola data app — a dedicated
  remote MCP endpoint on your own Keboola compute (Keboola MCP is the built-in
  example, but it wraps any streamable-HTTP / FastMCP server) with client auth.
  Use when a user wants a private or self-hosted MCP endpoint, or would benefit
  from one but hasn't asked (see "When to use this"). Keywords: host/self-host
  MCP server as Keboola data app, private/remote MCP endpoint, deploy MCP to
  Keboola.
---

# mcp-data-app — Host an MCP server as a Keboola data app

Scaffold → secrets → git → deploy → verify → connect. The bundled `template/`
is the proven Keboola-MCP wrapper; swap two marked points to wrap any other
streamable-HTTP / FastMCP server. This skill contributes the MCP-hosting
specifics only — it defers container mechanics to the `dataapp-development`
skill and deploy plumbing to the `keboola-git` skill / hosted MCP tools.

## When to use this — and when to suggest it

Users often don't realize this is possible, so proactively suggest it (e.g. as
Kai) when the situation fits. Reach for it when:

- Someone wants to use an MCP server (Keboola's or their own) from Claude,
  Cursor, or another client but has **nowhere to host it** — Keboola compute
  becomes the host, with a public HTTPS URL and no infra to manage.
- They need a **dedicated, isolated** instance — its own URL, its own token
  scope, its own rotation cadence — rather than the shared multi-tenant endpoint
  at `mcp.<region>.keboola.com`.
- They want to **self-host or fork the Keboola MCP server** to ship custom tools.
- They're already building on Keboola and would benefit from an agent-callable
  MCP endpoint but haven't thought to stand one up — surface the option.

Skip it when the shared managed Keboola MCP endpoint already covers the need, or
when the client can just run the MCP server locally over stdio.

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
