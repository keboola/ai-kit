# Design — `mcp-data-app` skill

**Date:** 2026-07-07
**Branch:** `feat/mcp-data-app-skill`
**Author:** Jordan Burger (with Claude)

## Problem

Hosting an MCP server as a private, single-tenant Keboola **data app** is a
proven but non-obvious pattern. The reference implementation
([`keboola-rnd/mcp-data-app-example`](https://github.com/keboola-rnd/mcp-data-app-example))
wraps the upstream Keboola MCP server in a Starlette app that adds client auth
(static bearer + OAuth-shape stubs) and ships the `keboola-config/` trio (nginx
reverse proxy with SSE + DNS-rebinding handling, supervisord, `setup.sh`). The
knowledge to reproduce it — and to generalize it to *any* MCP server — lives in
a README and one person's head. We want a Claude Code **skill** that an agent
can invoke to do this reliably end to end.

## Goal

A skill that lets an agent take an MCP server and stand it up as a Keboola data
app: scaffold the wrapper + `keboola-config/`, set the required secrets, push to
git, deploy, and verify — with the Keboola MCP server as the default worked
example and a documented path for wrapping other servers.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Scope | **Any MCP server** (general pattern), Keboola MCP as the primary worked example. |
| Home | **New sibling skill** `mcp-data-app` inside the `dataapp-developer` plugin. |
| Template delivery | **Bundle** the template files in the skill (self-contained; works for sandboxed/remote agents). |
| Deploy driver | **Programmatic when available, else manual** — concretely kbagent/keboola-git for this app type; Keboola UI as fallback. |
| Generality in v1 | **HTTP/FastMCP primary + a concise stdio→HTTP bridge note** (no second full template). |

## Key platform facts that shape the design

1. **An MCP-server data app is a Python/JS app.** Per
   `dataapp-development/references/deployment-paths.md`, Python/JS apps **cannot**
   deploy through the Streamlit MCP tools (`deploy_data_app` /
   `modify_streamlit_data_app` are Streamlit-only). They deploy via **git +
   `kbagent`**: either customer GitHub, or a **Keboola-managed Forgejo repo** via
   the **`keboola-git`** plugin. So the skill's "programmatic" deploy path is the
   kbagent/keboola-git flow; the manual fallback is the Keboola UI.
2. **App-level auth MUST be "None".** Keboola's app-level OIDC strips the
   `Authorization` header before it reaches the container, which breaks both the
   bearer and OAuth-shape flows. This maps to the "None — implement your own auth
   in code" option in `dataapp-development/references/authentication.md`; the MCP
   app *is* the code-level auth.
3. **The container mechanics already have a home.** The `/app` contract
   (nginx :8888, supervisord, `uv sync`, no `pip install`, `POST /`, no
   `[program:nginx]`) is fully documented in
   `dataapp-development/references/python-js-apps.md`. The new skill
   **cross-references** these rather than restating them; it only documents the
   MCP-specific deltas.
4. **Source-only push.** The Python MCP app carries no large build artifacts, so
   the keboola-git 15 MB / HTTP 413 build-at-deploy problem does not apply beyond
   a one-line "push source only; `uv sync` at deploy" note.

## Placement & structure

New skill: `plugins/dataapp-developer/skills/mcp-data-app/`

```
skills/mcp-data-app/
├── SKILL.md                          # router/spine: phased workflow + rich trigger description
├── reference/
│   ├── auth-patterns.md              # bearer middleware + OAuth-shape stubs; how they work; "No auth" app-level requirement
│   ├── adapting-to-any-server.md     # the swap points; stdio-only server → bridge variant (supergateway/mcp-proxy)
│   └── troubleshooting.md            # MCP-specific: 421 DNS-rebind, SSE buffering, 401/WWW-Authenticate discovery, localhost in discovery docs
├── template/                         # bundled, near-verbatim from the example repo
│   ├── server.py                     # server-agnostic auth wrapper; the mount block + deps are marked swap points
│   ├── pyproject.toml                # deps; upstream pin marked as swap point
│   ├── keboola-config/
│   │   ├── nginx/sites/default.conf
│   │   ├── supervisord/services/mcp-server.conf
│   │   └── setup.sh
│   └── .gitignore
└── scripts/
    └── scaffold.sh                   # copies template/ into a target dir; SCRIPT_DIR self-detection; runs from user project root
```

The skill deliberately keeps its own body small and defers to existing skills:

- **Container mechanics** → `dataapp-development` references (`python-js-apps.md`,
  `authentication.md`).
- **Deploy plumbing (managed git)** → `keboola-git` skill (provision repo, mint
  credential, push, `deploy_data_app` via kbagent).
- Its unique content = the MCP-hosting pattern (auth wrapper, OAuth-shape stubs,
  nginx MCP specifics), the bundled template, and the end-to-end workflow that
  ties scaffold → secrets → git → deploy → verify together.

## SKILL.md workflow (the spine)

1. **Choose the MCP server.**
   - Keboola MCP (default worked example) — mount upstream package, pin a tag.
   - Another HTTP/FastMCP server — same shape; apply swap points.
   - A stdio-only server → `reference/adapting-to-any-server.md` bridge variant.
2. **Scaffold.** Run `scripts/scaffold.sh <target-dir>` (or copy `template/`
   manually). For non-Keboola servers, apply the two swap points (the mount block
   in `server.py`, the deps in `pyproject.toml`).
3. **Configure secrets.** Required: `#KBC_STORAGE_API_URL`, `#KBC_STORAGE_TOKEN`,
   `#MCP_API_KEY` (`openssl rand -hex 32`), `#MCP_PUBLIC_URL` (set after first
   deploy). Optional: `KBC_WORKSPACE_SCHEMA`, `LOG_LEVEL`, `PORT`.
4. **Push to git.** Data apps clone from git. Detect the path: if `kbagent` is
   present, use the **keboola-git** managed-Forgejo flow (provision → credential
   → push); else push to customer GitHub/GitLab. Follow the "pick one path per
   session" rule from `deployment-paths.md`.
5. **Deploy.** kbagent `data-app create` / `deploy_data_app` (via keboola-git),
   OR the documented Keboola UI flow. Set **app-level auth = None**. Set
   auto-suspend ≥ 24h. Two-pass `MCP_PUBLIC_URL` dance: deploy → copy the app URL
   → set `#MCP_PUBLIC_URL` → redeploy so the OAuth-shape discovery docs advertise
   the real origin.
6. **Verify.** `curl /healthz`; the two `.well-known/oauth-*` docs (must show
   `MCP_PUBLIC_URL`, not `127.0.0.1:5000`); `401 + WWW-Authenticate` on `/mcp`;
   optional client smoke test (`mcp-remote` bearer header and/or the claude.ai
   "Add custom connector" OAuth-shape flow).

## Auth patterns (preserved from the example, server-agnostic)

- **Static bearer** — `Authorization: Bearer $MCP_API_KEY`, for managed agents /
  scripts / Claude Desktop JSON config via `mcp-remote`.
- **OAuth-shape stubs** — `/.well-known/oauth-*`, `/register`, `/authorize`,
  `/token`; `/token` is the real gate (`client_secret == MCP_API_KEY`, returns
  the same key as `access_token`). Lets the claude.ai "Add custom connector" GUI
  connect. Same security profile as bearer.

Both are gated by the one `MCP_API_KEY`. The auth wrapper is independent of which
MCP app is mounted, so it is reused verbatim for any server.

## Bundled template

Near-verbatim copy of the example repo's working files (a known-good baseline),
with two clearly-commented **swap points** for non-Keboola servers:

- `server.py` — the `create_server(...)` / mount block (what MCP app is mounted).
- `pyproject.toml` — the `dependencies` (which server package + pin).

The auth middleware, OAuth-shape routes, nginx, supervisord, and `setup.sh` are
server-agnostic and copied unchanged.

## Repo housekeeping (per CLAUDE.md)

1. Update `plugins/dataapp-developer/README.md` — document the new skill.
2. Bump `plugins/dataapp-developer/.claude-plugin/plugin.json` 1.3.0 → **1.4.0**
   (new feature = minor).
3. Bump the `dataapp-developer` entry in `.claude-plugin/marketplace.json` to
   1.4.0.
4. Add the skill to the root `README.md` feature list for the plugin.

## Non-goals (v1)

- No second full template for stdio/Node servers (bridge is a documented note).
- No custom-tool authoring guide beyond a pointer (the example's
  "add `@mcp_server.tool()`" note).
- No real OAuth authorization server (the stubs are intentionally the pattern).
- Not fixing the stale `dataapp-developer:dataapp-deployment` / `:dataapp-dev`
  cross-references in the keboola-git skill (out of scope; note for follow-up).

## To verify during implementation

- Current upstream `keboola-mcp-server` tag to pin in `template/pyproject.toml`
  (example used `@v1.61.0`; confirm latest stable).
- Exact kbagent tool-call sequence for create+deploy of a python-js app from a
  managed repo (documented in `keboola-git/skills/keboola-git/SKILL.md`; reuse,
  don't reinvent).
- `claude plugin validate .` passes after the additions.

## Testing / validation

- `claude plugin validate .` clean.
- `scripts/scaffold.sh` produces a tree that passes
  `kbagent data-app validate-repo --type python-js` (golden-rule structure, no
  `pip install`, port match).
- `template/server.py` imports/parses and `python -c` compiles; local `uv run
  python server.py` boots and `/healthz` responds (spot check, not full deploy).
