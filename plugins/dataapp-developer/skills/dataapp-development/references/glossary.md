# Glossary and external references

**Use this when:** you need to find a tool's source repo, a library's docs, or the canonical UI location of a Keboola feature mentioned elsewhere in this skill.

The instructional references avoid inline links to keep them focused on patterns and avoid stale citations. This file is the one place external pointers live. When something cited in another reference (a tool, a library, a base image) needs a canonical source, look it up here.

## Tools

### Keboola MCP server

Source: https://github.com/keboola/mcp-server

The MCP server that exposes Keboola tools to agents. Provides:

- **Data app lifecycle:** `modify_data_app`, `deploy_data_app`, `get_data_apps` (Streamlit only today).
- **Data validation:** `get_project_info`, `get_table`, `query_data`, `search`.
- **Docs lookup:** `docs_query` — searches the Keboola Connection documentation. Prefer this over guessing from memory.
- **Config management:** `get_components`, `find_component_id`, `get_configs`, `create_config`, `update_config`, `add_config_row`, `update_config_row`, `run_sync_action`.
- **Storage / flows / OAuth:** `get_buckets`, `get_tables`, `get_flows`, `modify_flow`, `create_oauth_url`, `get_jobs`, `run_job`.

Most agent environments expose these as `mcp__keboola__*`. The exact tool surface depends on the server version.

### kbagent CLI

Source: https://github.com/padak/keboola_agent_cli

Command-line tool for Keboola operations. Install:

```bash
uv tool install git+https://github.com/padak/keboola_agent_cli
```

Configure a project:

```bash
kbagent project add --project <alias> --url <KBC_URL> --token <KBC_TOKEN>
kbagent doctor          # sanity check
kbagent project list
```

The `kbagent data-app` command group covers the full data-app lifecycle (create, deploy, start, stop, password, secrets-*, validate-repo, list, detail, delete). See `references/deployment-paths.md` §Path C.

For the deeper data-app gotchas (per-project KMS encryption, transient state == stopped during initial deploy, auto-injected `parameters.id`), the canonical write-up lives in the kbagent skill's own references (`plugins/kbagent/skills/kbagent/references/data-app-workflow.md` in this same marketplace).

### data-app-python-js base image

Source: https://github.com/keboola/data-app-python-js

The Docker base image for Python/JS Keboola Apps. Debian Bookworm slim with Python (via `uv`), Node.js, Bun, Nginx, Supervisord. The image clones the app repo from Git on container startup, runs `keboola-config/setup.sh`, then starts the app via Supervisord behind Nginx on port 8888.

Useful sub-docs in that repo:

- `README.md` — entrypoint flow, env vars, secrets handling, examples for single-Python / single-Node / multi-server apps.
- `docs/bootstrap.md` — the customizable bootstrap hook for derived images.
- `docs/dev-mode.md` — `KBC_APP_MODE=dev` hot-reload contract.

## Libraries

### kai-client (Kai chat embed)

Source: https://github.com/keboola/kai-client

Python async client for the Keboola AI Assistant (Kai). Provides SSE streaming, session management, tool-approval flow, and a `kai` CLI. JS apps integrate by proxying HTTP requests to the same `/api/chat` endpoint — no separate JS package needed.

The repo also ships its own skill plugin (`plugins/kai-dataapp/skills/{kai-js, kai-streamlit}`) covering deeper integration patterns (full chat UI, history, voting, tool-approval UX).

Install (Python apps):

```bash
uv add kai-client
```

See `references/kai-integration.md` for the embed patterns.

### keboola-query-service (RW Storage Access)

Python SDK: https://github.com/keboola/query-service-api-python-sdk

JS/TS SDK: https://github.com/keboola/query-service-api-js-sdk

Used when the app writes back to Storage tables via the Query Service (Snowflake projects with the **Storage Access** feature enabled). Provides authenticated `execute_query` against a permission-scoped workspace.

First-class SQL helpers (`SQL.literal()`, `SQL.ident()`, `sql.format()`) are in development in both SDKs. Until released, use the manual sanitization pattern shown in `references/storage-access.md` (allowlists for strings, type-coercion for numbers).

Install:

```bash
# Python
uv add keboola-query-service

# JS
npm install @keboola/query-service
```

### keboola-streamlit (helper utilities)

Source: https://github.com/keboola/keboola_streamlit

Streamlit utility package: read/write tables via simple `keboola.read_table()` / `keboola.write_table()`, AgGrid Enterprise license accessor, Snowflake session helpers. Pre-installed in the Streamlit base image — you don't need to declare it.

## Keboola Connection UI locations

When a reference mentions a UI navigation step, here's where to find it. The exact wording varies by UI version.

| Feature | Path in the project UI |
|---|---|
| Workspaces (provision a Snowflake/BigQuery workspace) | **Workspaces** (older UI: "Sandboxes" or "Transformations → Workspaces") |
| API Tokens (create a scoped Storage API token) | **Settings → API Tokens** (or "Users & Settings → API Tokens") |
| Data Apps (list, deploy, view logs, edit config) | **Apps** in the left nav |
| Storage Access feature toggle | **Settings → Features → Storage Access** (must be enabled per project) |
| Storage tables and buckets | **Storage** in the left nav |
| Development Branches (find numeric branch ID) | **Development Branches** in the left nav |
| Data App Terminal Log | inside the data app config: **Terminal Log** tab |
| Streamlit Theming UI | inside the Streamlit app config: **Theme** section in **Configuration** |

## Canonical platform docs

When this skill's references don't answer a question, the canonical Keboola Connection documentation lives at `help.keboola.com/data-apps/`. Prefer calling the MCP `docs_query` tool to search them — it returns the authoritative answer scoped to the question rather than requiring the agent to navigate the full doc tree.

Key doc pages for data apps:

- Apps overview: `help.keboola.com/data-apps/`
- Streamlit apps: `help.keboola.com/data-apps/streamlit/`
- Python/JS apps: `help.keboola.com/data-apps/python-js/`
- Storage Access: `help.keboola.com/data-apps/storage-access/`
- Authentication: `help.keboola.com/data-apps/authentication/`
- Backend versions (Streamlit pre-installed packages, Python versions): `help.keboola.com/data-apps/backend-versions/`
- Terminal Log tab: `help.keboola.com/data-apps/terminal-log-tab/`
- General Design Guide (Streamlit logo/footer/anchor patterns): `help.keboola.com/data-apps/general-design-guide/`
- OIDC configuration (per provider): `help.keboola.com/data-apps/authentication/{auth0|google-cloud-platform|microsoft-entra-id|okta}/`
