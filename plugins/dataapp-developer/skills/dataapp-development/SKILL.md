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

- **Path A — Claude Desktop / web (MCP-only, no filesystem):** Use `modify_data_app` / `deploy_data_app` MCP tools (Streamlit only today).
- **Path B — Claude Code / local agent with filesystem + MCP:** Edit files locally, push to customer git, deploy via MCP or kbagent.
- **Path C — CLI agent (`kbagent`):** Full lifecycle via `kbagent data-app` command group.

### 4. Any cross-cutting concerns?

| Concern | Reference |
|---|---|
| Reading from / writing to Keboola Storage | `references/storage-access.md` |
| Securing the app (login, SSO, OAuth) | `references/authentication.md` |
| Making the app fast / avoiding repeated Snowflake hits | `references/duckdb-caching.md` |
| Styling — default look or brand override | `references/styling-guide.md` |
| Building a dashboarding-style app | `references/dashboard-patterns.md` |
| Adding a natural-language assistant to the app | `references/kai-integration.md` |

## Reference index

| File | Use when |
|---|---|
| `references/choosing-app-type.md` | You don't yet know which app type to build. |
| `references/streamlit-apps.md` | You're building a Streamlit app (Code or Git deployment). |
| `references/python-js-apps.md` | You're building a Python/JS app (single Node, single Python, or combined). |
| `references/deployment-paths.md` | You need to know which tool to use (MCP / Claude Code / kbagent). |
| `references/storage-access.md` | The app reads from or writes to Keboola Storage. |
| `references/authentication.md` | You need to pick or configure an auth method. |
| `references/duckdb-caching.md` | The app is read-only and would benefit from query caching. |
| `references/styling-guide.md` | You need brand-default styling or a customer override. |
| `references/dashboard-patterns.md` | You're building a dashboarding app (sidebar filters, charts, metrics). |
| `references/kai-integration.md` | You want to embed Kai chat in the app. |
| `references/dev-workflow.md` | You're modifying an existing app and want the validate→build→verify loop. |
| `references/troubleshooting.md` | The app is failing, returning errors, or behaving unexpectedly. |

## Templates index

| Template | Use when |
|---|---|
| `templates/streamlit/` | New Streamlit app, code or git deployment. |
| `templates/python-app/` | New Python-only Python/JS app (Flask or similar). |
| `templates/nodejs-app/` | New dashboarding app (Node.js + static frontend — the preferred default). |
| `templates/python-node-app/` | New combined Python backend + JS frontend app. |
| `templates/duckdb-cache/` | Adding the DuckDB caching pattern to an existing Python or Node app. |

## Hard rules (apply to every task)

1. **Never commit `.streamlit/secrets.toml`** or any file with real credentials. Add to `.gitignore` before committing.
2. **RO workspace before input mapping.** New apps default to the RO workspace pattern. Input mapping is discouraged — see `references/storage-access.md`.
3. **Apps must handle `POST /`** on the root path. Keboola POSTs to `/` on startup. Streamlit handles this natively; Flask needs `methods=["GET", "POST"]`; Express needs `app.all('/')`.
4. **No `pip install` in Python apps.** The base image blocks PEP 668. Use `uv sync` driven by `pyproject.toml`. All Python supervisord commands must use `uv run`.
5. **Never declare `[program:nginx]`** in `keboola-config/supervisord/`. Nginx is managed by the base image.
6. **Validate data first, code second.** When using Keboola MCP, call `get_table` and `query_data` to confirm schema before writing SQL. See `references/dev-workflow.md`.
