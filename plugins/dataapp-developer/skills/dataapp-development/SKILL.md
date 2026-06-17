---
name: dataapp-development
description: Use when building, modifying, deploying, or debugging Keboola Apps (Streamlit or Python/JS). Covers the full lifecycle — choosing app type, configuring keboola-config/, storage access (RO workspace, RW Query Service, input mapping), authentication, DuckDB caching for performance, default Keboola styling, dashboard patterns, optional Kai chat integration, and the three client paths (MCP-only, Claude Code with filesystem, kbagent CLI).
---

# Keboola App Development

This skill covers the full lifecycle of Keboola Apps (formerly "Data Apps"): choosing the right app type, building locally, deploying, and debugging. It supports both **Streamlit** apps and **Python/JS** apps, and three client paths (MCP-only, Claude Code with filesystem access, and `kbagent` CLI).

The skill is a router — it does not contain all the guidance itself. The `references/` files load on demand based on the task at hand. Read the decision tree below, then load only the references you need.

## Decision tree

Answer these questions in order. Each answer routes to the right reference.

### 1. What is the task?

| Task | Where to look first |
|---|---|
| Build a new app from scratch | `references/choosing-app-type.md` → type-specific reference → `references/deployment-paths.md` |
| Modify an existing app (add feature, fix bug) | `references/dev-workflow.md` for the change loop |
| Deploy or redeploy | `references/deployment-paths.md` |
| Debug a deployment or runtime issue | `references/troubleshooting.md` |
| Migrate an existing app between types | `references/choosing-app-type.md` + `references/streamlit-apps.md` + `references/python-js-apps.md` |

### 2. Which app type?

If unsure → `references/choosing-app-type.md`. Short version:

- **Streamlit** — fastest when the team is Python-only and the UI is mostly sidebar + main pane. Read `references/streamlit-apps.md`.
- **Single Node.js + static frontend** — the dashboarding default. One process, no bundler, Chart.js/Tailwind via CDN. Read `references/python-js-apps.md`.
- **Combined Python + Node** — only when you genuinely need a Python backend (ML model, existing Python codebase). Read `references/python-js-apps.md` (multi-server section).

### 3. Which client path?

`references/deployment-paths.md` covers all three:

- **Path A — Claude Desktop / web (MCP-only, no filesystem):** Use `modify_streamlit_data_app` / `deploy_data_app` MCP tools (Streamlit only today).
- **Path B — Claude Code / local agent with filesystem + MCP:** Edit files locally, push to customer git, deploy via MCP or kbagent.
- **Path C — CLI agent (`kbagent`):** Full lifecycle via `kbagent data-app` command group.

### 4. Any cross-cutting concerns?

| Concern | Reference |
|---|---|
| Reading from / writing to Keboola Storage (RO default uses DuckDB cache) | `references/storage-access.md` + `references/duckdb-caching.md` |
| Securing the app (login, SSO, OAuth) | `references/authentication.md` |
| Cutting DWH costs and speeding up read-only dashboards (default for RO apps) | `references/duckdb-caching.md` |
| Styling — default Keboola palette and footer | `references/styling-guide.md` |
| Styling — bundled React+Vite+shadcn stack | `references/styling-react-bundled.md` |
| Building a dashboarding-style app | `references/dashboard-patterns.md` |
| Adding a natural-language assistant to the app | `references/kai-integration.md` |
| Source repos / canonical docs / UI navigation | `references/glossary.md` |

## Templates index

| Template | Use when |
|---|---|
| `templates/streamlit/` | New Streamlit app, code or git deployment. |
| `templates/python-app/` | New Python-only Python/JS app (Flask or similar). |
| `templates/nodejs-app/` | New dashboarding app (Node.js + static frontend — the preferred default). |
| `templates/python-node-app/` | New combined Python backend + JS frontend app. |
| `templates/duckdb-cache/` | Adding the DuckDB caching pattern to an existing Python or Node app. |

## Need authoritative Keboola docs?

The Keboola MCP server exposes a `docs_query` tool that searches the official Keboola Connection documentation. When this skill's references don't answer a question — UI navigation specifics, edge cases, recent platform changes — call `docs_query` to get the canonical answer rather than guessing or relying on stale memory.

## Hard rules (apply to every task)

1. **Never commit `.streamlit/secrets.toml`** or any file with real credentials. Add to `.gitignore` before committing.
2. **RO workspace before input mapping.** New apps default to the RO workspace pattern. Input mapping is discouraged — see `references/storage-access.md`.
3. **Apps must handle `POST /`** on the root path. Keboola POSTs to `/` on startup. Streamlit handles this natively; Flask needs `methods=["GET", "POST"]`; Express needs `app.all('/')`.
4. **No `pip install` in Python apps.** The base image blocks PEP 668. Use `uv sync` driven by `pyproject.toml`. All Python supervisord commands must use `uv run`.
5. **Never declare `[program:nginx]`** in `keboola-config/supervisord/`. Nginx is managed by the base image.
6. **Validate data first, code second.** When using Keboola MCP, call `get_table` and `query_data` to confirm schema before writing SQL. If the project has a semantic layer, check it first via `search_semantic_context` / `get_semantic_context` and ground the query in those definitions rather than inventing the calculation. See `references/dev-workflow.md`.
7. **Pick one Keboola path per session.** Before any project-mutating call, run BOTH detection checks (`which kbagent` + scan for `mcp__*[Kk]eboola*` tools) and ask the user which to use if more than one is present. Don't silently pick. See `references/deployment-paths.md` §Pick one path per session.
8. **MCP-only flows: compose source directly into the tool call.** When the chosen path is `modify_streamlit_data_app`, the `source_code` argument **is** the deployment artifact — don't pre-write a local copy. See `references/deployment-paths.md` Path A.
9. **For local-dev credentials: pre-fill what you can, ask for what's missing, then offer to run.** Never grep the filesystem or scan unrelated env vars for tokens. See `references/storage-access.md` §Getting the env vars for local development.
