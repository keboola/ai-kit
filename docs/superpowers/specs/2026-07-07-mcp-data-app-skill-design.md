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
| Deploy driver | **Programmatic when available, else manual.** Three programmatic drivers, one manual fallback: **kbagent** CLI, **keboola-git** (managed Forgejo), **Kai / hosted Keboola MCP tools**; Keboola UI as fallback. |
| Kai support | **Both** — Kai (or any agent with the hosted Keboola MCP) can DRIVE the deploy via the python-js data-app MCP tools, AND Kai is documented as a CLIENT that connects to the deployed endpoint. |
| Generality in v1 | **HTTP/FastMCP primary + a concise stdio→HTTP bridge note** (no second full template). |

## Key platform facts that shape the design

1. **An MCP-server data app is a Python/JS app**, deployed from **git**. There are
   three programmatic ways to drive that, plus a manual fallback:
   - **kbagent CLI** — `kbagent data-app validate-repo / create / deploy /
     secrets-set` against customer GitHub or a managed repo (`deployment-paths.md`
     Path C).
   - **keboola-git (managed Forgejo)** — provision repo → mint push credential →
     raw `git push` → deploy, all via `kbagent … tool call` (the `keboola-git`
     skill).
   - **Kai / hosted Keboola MCP tools** — the hosted Keboola MCP exposes
     `modify_python_js_data_app` (creates the config + managed repo, returns
     `repo_url`), `create_python_js_data_app_git_credential` (push credential),
     and `deploy_data_app`. Any agent with these tools — Kai in-product, or Claude
     with the hosted Keboola MCP connected — can drive the deploy. This is the
     **same underlying managed-git mechanism** keboola-git wraps via `kbagent tool
     call`, just reached through MCP tools directly. The git push step still needs
     a git-capable runner (raw `git push` with the minted credential).
   - **Manual Keboola UI** — point Apps → Create App at the git repo, add secrets,
     deploy.

   **Note / correction:** `deployment-paths.md` still labels Python/JS-via-MCP a
   "placeholder," but the `modify_python_js_data_app` /
   `create_python_js_data_app_git_credential` / `deploy_data_app` tools are live in
   the hosted MCP surface today. The skill treats the MCP-tools path as real and
   flags the stale doc as a follow-up (not fixed here).
   The Streamlit-only tools (`modify_streamlit_data_app`) do **not** apply.
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
│   ├── deploy.md                     # deploy path selection (kbagent / keboola-git / Kai & hosted-MCP tools / manual UI); secrets; app-level "None"; two-pass MCP_PUBLIC_URL; verify-from-logs
│   ├── auth-and-clients.md           # server-side auth mechanism (bearer middleware + OAuth-shape stubs) AND connect recipes: static bearer, claude.ai OAuth-shape connector, Kai-as-client
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
- **Deploy plumbing (managed git via kbagent)** → `keboola-git` skill (provision
  repo, mint credential, push, `deploy_data_app`).
- **Deploy plumbing (hosted MCP tools, incl. Kai)** → the python-js data-app MCP
  tools directly; `deploy.md` documents the tool sequence and when each driver
  applies.
- Its unique content = the MCP-hosting pattern (auth wrapper, OAuth-shape stubs,
  nginx MCP specifics), the bundled template, the client-connect recipes (bearer,
  claude.ai OAuth-shape, Kai), and the end-to-end workflow that ties scaffold →
  secrets → git → deploy → verify together across all four deploy drivers.

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
4. **Push to git & deploy.** Data apps clone from git. Detect the driver at
   session start (per `deployment-paths.md` "pick one path per session"), then use
   whichever is present — do not mix:
   - **kbagent present** → keboola-git managed-Forgejo flow (provision →
     credential → `git push` → `deploy_data_app`), or customer GitHub + `kbagent
     data-app create/deploy`.
   - **Hosted Keboola MCP present (Kai, or Claude + hosted MCP)** →
     `modify_python_js_data_app` (config + managed repo) →
     `create_python_js_data_app_git_credential` → `git push` with the credential →
     `deploy_data_app`. Secrets via the same tool surface.
   - **Neither** → manual Keboola UI (Apps → Create App at the git repo URL/branch).

   In all drivers: set **app-level auth = None**, auto-suspend ≥ 24h, and run the
   two-pass `MCP_PUBLIC_URL` dance — deploy → copy the app URL → set
   `#MCP_PUBLIC_URL` → redeploy so the OAuth-shape discovery docs advertise the
   real origin (not `127.0.0.1:5000`).
5. **Verify.** Prefer the logs as the authoritative signal (per keboola-git):
   look for the server process reaching RUNNING. Then `curl /healthz`; the two
   `.well-known/oauth-*` docs (must show `MCP_PUBLIC_URL`); `401 +
   WWW-Authenticate` on `/mcp`.
6. **Connect a client.** Provide the recipes (see `auth-and-clients.md`):
   - **Static bearer** — managed agents / scripts / Claude Desktop JSON via
     `mcp-remote` with `Authorization: Bearer $MCP_API_KEY`.
   - **claude.ai "Add custom connector"** — OAuth-shape flow; client secret =
     `MCP_API_KEY`.
   - **Kai (as client)** — point the Keboola AI Assistant at the endpoint using
     the bearer/OAuth-shape credential. Exact Kai custom-connector mechanism is a
     verify-during-implementation item (see below).

## Auth patterns (preserved from the example, server-agnostic)

- **Static bearer** — `Authorization: Bearer $MCP_API_KEY`, for managed agents /
  scripts / Claude Desktop JSON config via `mcp-remote`.
- **OAuth-shape stubs** — `/.well-known/oauth-*`, `/register`, `/authorize`,
  `/token`; `/token` is the real gate (`client_secret == MCP_API_KEY`, returns
  the same key as `access_token`). Lets the claude.ai "Add custom connector" GUI
  connect. Same security profile as bearer.

Both are gated by the one `MCP_API_KEY`. The auth wrapper is independent of which
MCP app is mounted, so it is reused verbatim for any server. Any MCP client —
Claude Desktop, claude.ai, Cursor/Windsurf, and **Kai** — connects through one of
these two mechanisms; there is nothing Kai-specific in the server.

## Kai support

Kai (the Keboola AI Assistant) shows up in two distinct roles, and the skill
covers both:

1. **Kai as a deploy driver.** When the acting agent is Kai in-product (or Claude
   with the hosted Keboola MCP), it has the python-js data-app tools and can drive
   the full deploy without kbagent: `modify_python_js_data_app` →
   `create_python_js_data_app_git_credential` → `git push` → `deploy_data_app`,
   plus secret-setting via the same surface. `reference/deploy.md` documents this
   as a first-class driver alongside kbagent and keboola-git.
2. **Kai as a client.** Once deployed, the endpoint is a normal remote MCP server,
   so Kai can consume it via the bearer or OAuth-shape credential like any other
   client. The precise "add a custom MCP connector to Kai" UX is unconfirmed and
   flagged to verify during implementation; the auth contract it would use is
   already settled (URL + `MCP_API_KEY`).

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
- Not editing `deployment-paths.md`'s Python/JS-via-MCP "placeholder" claim, even
  though we found the tools are live — flag as a follow-up, don't fix here.
- No Kai-embedded-assistant (`kai-client`) UI inside the app — an MCP endpoint is
  headless; that pattern is unrelated.

## To verify during implementation

- Current upstream `keboola-mcp-server` tag to pin in `template/pyproject.toml`
  (example used `@v1.61.0`; confirm latest stable).
- Exact kbagent tool-call sequence for create+deploy of a python-js app from a
  managed repo (documented in `keboola-git/skills/keboola-git/SKILL.md`; reuse,
  don't reinvent).
- Behavior of the hosted-MCP python-js data-app tools
  (`modify_python_js_data_app`, `create_python_js_data_app_git_credential`,
  `deploy_data_app`) for the Kai-driven deploy path — confirm the argument shape
  and that they operate on the managed repo the same way the kbagent tool-call
  wrappers do.
- Whether/how Kai supports adding a custom remote MCP connector (the Kai-as-client
  UX). If it isn't supported yet, document the auth contract and mark the UX
  as pending rather than inventing steps.
- `claude plugin validate .` passes after the additions.

## Testing / validation

- `claude plugin validate .` clean.
- `scripts/scaffold.sh` produces a tree that passes
  `kbagent data-app validate-repo --type python-js` (golden-rule structure, no
  `pip install`, port match).
- `template/server.py` imports/parses and `python -c` compiles; local `uv run
  python server.py` boots and `/healthz` responds (spot check, not full deploy).
