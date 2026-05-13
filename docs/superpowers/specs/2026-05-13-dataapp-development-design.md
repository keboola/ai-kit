# dataapp-development skill — design spec

Date: 2026-05-13
Status: Draft, awaiting user review

## Goal

Consolidate the existing `dataapp-dev` (Streamlit-only, validate→build→verify) and `dataapp-deployment` (Nginx/Supervisord/Docker) skills into a single `dataapp-development` skill covering the full lifecycle of Keboola Apps for both Streamlit and Python/JS types.

The new skill must:
- Activate whenever a user builds, modifies, deploys, or debugs a Keboola App.
- Stay lean in main-file context. The `SKILL.md` is a router; the actual guidance lives in topical reference files that load on demand.
- Cover three distinct client paths: MCP-only (Claude Desktop), Claude Code + filesystem + MCP, and CLI agents using `kbagent`.
- Preserve the proven validate→build→verify workflow without forcing it on tasks that don't need it (e.g. pure deployment).
- Include opinionated patterns the platform team wants to push: DuckDB caching as the default for read-only apps, RO workspace as the default for storage access.

## Non-goals

- Streamlit-only refactors. The Streamlit type is on a deprecation path; both types are first-class in this skill.
- Replacing or duplicating the official Keboola docs at `help.keboola.com/data-apps/`. The skill points to them; it does not mirror them.
- Building an MCP client for the Keboola-managed git provider. That tooling is unfinished; the skill includes a placeholder reference and tells the agent to fall back to customer-provided git.

## Scope of consolidation

| Old artifact | New home |
|---|---|
| `dataapp-dev/SKILL.md` (Streamlit validate→build→verify) | `references/dev-workflow.md` + `references/streamlit-apps.md` |
| `dataapp-dev/best-practices.md` | `references/dashboard-patterns.md` + `references/streamlit-apps.md` |
| `dataapp-dev/workflow-guide.md` | `references/dev-workflow.md` (condensed examples) |
| `dataapp-dev/templates.md` | `templates/streamlit/` (runnable) + inline snippets in references |
| `dataapp-dev/validation-checklist.md` | `references/dev-workflow.md` (collapsed into checklist section) |
| `dataapp-dev/QUICKSTART.md` | Subsumed by the new `SKILL.md` decision tree |
| `dataapp-deployment/SKILL.md` | `references/python-js-apps.md` + `references/troubleshooting.md` |

Both old skill directories get deleted.

## Directory layout

```
plugins/dataapp-developer/skills/dataapp-development/
├── SKILL.md
├── references/
│   ├── choosing-app-type.md
│   ├── streamlit-apps.md
│   ├── python-js-apps.md
│   ├── deployment-paths.md
│   ├── storage-access.md
│   ├── authentication.md
│   ├── duckdb-caching.md
│   ├── styling-guide.md
│   ├── dashboard-patterns.md
│   ├── kai-integration.md
│   ├── dev-workflow.md
│   └── troubleshooting.md
└── templates/
    ├── streamlit/
    │   ├── streamlit_app.py
    │   ├── pyproject.toml
    │   ├── .streamlit/secrets.toml.example
    │   └── utils/data_loader.py
    ├── python-app/
    │   ├── app.py
    │   ├── pyproject.toml
    │   └── keboola-config/
    │       ├── nginx/sites/default.conf
    │       ├── supervisord/services/app.conf
    │       └── setup.sh
    ├── nodejs-app/
    │   ├── server.js
    │   ├── package.json
    │   └── keboola-config/
    │       ├── nginx/sites/default.conf
    │       ├── supervisord/services/app.conf
    │       └── setup.sh
    └── duckdb-cache/
        ├── python/cache.py
        └── nodejs/duck.js
```

## SKILL.md contract

Length target: 150 lines or fewer. Sections:

1. **Frontmatter** — name, description (trigger phrases for Streamlit, Python/JS, build, deploy, debug, dashboard, data app, etc.).
2. **What this skill covers** — one paragraph.
3. **Decision tree** — four questions the agent answers in order:
   1. What is the task? (new build / modify / deploy / debug / migrate)
   2. Which app type? (link to `choosing-app-type.md` if unclear)
   3. Which client path? (link to `deployment-paths.md`)
   4. Any cross-cutting concern? (storage, auth, styling, caching, Kai)
4. **Reference index** — one-line description per reference file, link to each.
5. **Templates index** — one-line description per template directory.
6. **Hard rules** that apply to every task (e.g. "never commit `.streamlit/secrets.toml`", "RO workspace before input mapping", "POST handling on `/`", "no `pip install` — `uv sync` only").

The decision tree must be readable as a flowchart and not require the agent to read sub-references for routing decisions.

## Reference file contracts

Each file has a 1-line description in its frontmatter (or first heading) so the agent can decide whether to load it without reading the whole file.

### `references/choosing-app-type.md`
- When to pick Streamlit vs Python/JS.
- Decision criteria: code complexity, frontend needs, deployment method available, language constraints.
- Pointer that Streamlit will deprecate eventually and JS/Python is the future.

### `references/streamlit-apps.md`
- Two deployment modes: **Code** (paste in UI) vs **Git Repository** (public/private with PAT or SSH).
- Default packages pre-installed in the base image (`streamlit`, `pandas`, `numpy`, etc.).
- `secrets.toml` — direct UI upload (flat keys) vs repo-based (supports nested groups).
- Theme via Keboola Theming UI (predefined themes + custom) vs `parameters.dataApp.streamlit.config.toml` raw override (preserves non-`[theme]` sections).
- Default Keboola theme values (primary `#1F8FFF`, bg `#FFFFFF`, secondary `#E6F2FF`, text `#222529`, sans serif).
- AgGrid Enterprise license is pre-configured platform-wide.
- **Local development section:**
  - Install deps with `uv sync` (or `pip install -e .`) — the local box does NOT have the PEP-668 restriction.
  - Run with `streamlit run streamlit_app.py` on `:8501` (default Streamlit port).
  - Local credentials in `.streamlit/secrets.toml` (gitignored). Production credentials come from Keboola `dataApp.secrets` as env vars.
  - Env-parity pattern: `os.environ.get('KBC_TOKEN') or st.secrets.get('KBC_TOKEN')` so the same code works in both environments without branching.
  - Hot reload: just save the file — Streamlit auto-reloads. No restart needed.
  - For the validate→build→verify change loop, point to `dev-workflow.md`.

### `references/python-js-apps.md`
- The `/app` contract: nginx/sites/`*.conf`, supervisord/services/`*.conf`, optional `setup.sh`, optional `run.sh`.
- Nginx listens on `:8888` (hardcoded by the platform); only ports ≥1024 supported.
- App listens on any internal port; nginx reverse-proxies to it.
- App must handle `POST /` (Keboola startup check). Streamlit handles natively; Flask/Express need explicit handlers.
- Supervisord rules: absolute `/app/...` paths, `uv run` prefix for Python, never declare `[program:nginx]`.
- `pyproject.toml` is required for Python — `pip install` is blocked by PEP 668; `uv sync` only.
- Multi-server pattern (Python + Node simultaneously), citing the profitline-js-app shape (FastAPI + Next.js).
- Git commit locking — exit code 153 means the locked commit no longer exists in the remote.
- Keboola-hosted dev mode (`KBC_APP_MODE=dev`, `supervisord-dev/`, `setup-dev.sh`, `dev-deps`) for hot-reload off a branch inside the platform.
- Bootstrap hook (derived images) — note that customers usually don't need to touch this.
- **Deployment via MCP (Keboola-managed git) — PLACEHOLDER:**
  - Future flow: provision a Keboola-managed git repo for the Python/JS app through MCP tooling instead of customers supplying their own GitHub/GitLab repo.
  - Planned developer flow: feature branch → preview deployment → merge to main → production deployment.
  - Status today: not yet finished. Agents working on Python/JS apps fall back to **customer-provided git** (private GitHub/GitLab with PAT or SSH key) as the only supported path.
  - When the platform support lands, this section expands; if it grows past ~50 lines, split into its own reference.
  - Link to upstream Linear issue / GitHub PR when available so agents can check status without reloading the skill.
- **Local development section:**
  - **Skip nginx and supervisord locally** — run your app process directly. Nginx/supervisord exist only to satisfy the Keboola container contract.
  - Install deps: Python → `uv sync` from the repo root; Node → `npm install`.
  - Run the app directly: `uv run python app.py` (Flask), `uv run uvicorn app:app --reload --port 5000` (FastAPI), `node --watch server.js` (Express), or `npm run dev` for bundled toolchains (Vite, Next.js).
  - Visit `http://localhost:<internal-port>` directly — do NOT add a local nginx on :8888.
  - Local secrets: pattern from `kai-pricing-calculator-app` — load from `.env` (Node), `.streamlit/secrets.toml` (works for both types as the kai-pricing app does), or shell exports. Mirror the same env-var names Keboola injects (`KBC_URL`, `KBC_TOKEN`, `KBC_WORKSPACE_ID`, `BRANCH_ID`).
  - Env-parity pattern: read from `process.env.X` / `os.environ.get("X")` everywhere; in dev, populate those from your local file. The same code runs unchanged in Keboola where `dataApp.secrets` populates the same env vars.
  - Quick local-vs-prod sanity check: run the exact same command your `supervisord/services/app.conf` uses (just point to the right Python interpreter). If it works locally, it works in Keboola.
  - Multi-server local dev: run each process in its own terminal; let your frontend dev server proxy `/api/*` to the backend (Next.js: `next.config.ts` rewrites; Vite: `server.proxy`). This skips nginx locally entirely.
  - For the validate→build→verify change loop, point to `dev-workflow.md`.

### `references/deployment-paths.md`
- **Path A — Claude Desktop / web (MCP-only, no filesystem).**
  - Use `modify_data_app` to write source code into the data app configuration (Streamlit only today).
  - Use `deploy_data_app` to deploy/stop.
  - Use `get_data_apps` for inventory and to read logs (tail 20 lines).
  - Limitations: only `streamlit` type; no git mode via MCP.
- **Path B — Claude Code / local agent with filesystem + MCP.**
  - Edit code locally, push to customer git, then `deploy_data_app` via MCP (Streamlit) or use kbagent.
  - For Python/JS, must use git (no "code" mode for that type) — push then deploy.
- **Path C — CLI agent (`kbagent`).**
  - Full lifecycle: `create`, `deploy`, `start`, `stop`, `delete`, `secrets-set`, `secrets-list`, `password`, `validate-repo`.
  - `validate-repo` before `create` to catch golden-rule violations without burning a deploy cycle.
  - `--git-pat-env` is the preferred private-repo auth — token never appears in argv.
  - Use `kbagent config update` for any field that lives on the Storage config (size, auto-suspend, git block), then `kbagent data-app deploy`.
  - Reference: detailed gotchas live in `kbagent` skill's own `data-app-workflow.md`; here we only summarize.

### `references/storage-access.md`
- **Default: RO workspace.** The MCP `modify_data_app` tool injects a `query_data(sql) -> DataFrame` function. Use it. Don't roll your own.
- **For Python/JS apps without MCP injection:** use the Query Service API directly (POST to `/v2/storage/branch/{branch}/workspaces/{workspace}/query`) — example from `kai-pricing-calculator-app/api/keboola-client.js`.
- **RW direct access (Storage Access).** Snowflake only. Configure `storage.output.tables[].unload_strategy = "direct-grant"`. Use `keboola-query-service` (Python) or `@keboola/query-service` (JS). Ephemeral workspace recreated on every app start. **SQL-injection risk** — validate/sanitize all user input (allowlists, type coercion).
- **Input mapping — discouraged for new apps.** Snapshot at deploy time, no fresh data, no write-back. Use only for static reference data.
- **Permission scoping by user.** Not currently supported at the app-storage level (column-level perms also missing). Pattern for now: filter in app code based on `X-Kbc-User-Email` header (the platform injects it), as profitline-js-app does. Mention this is a workaround until platform-level support lands.

### `references/authentication.md`
- Six options: None, Basic (Keboola-generated password), OIDC (Auth0/Google/Entra ID/Okta), GitHub OAuth, GitLab OAuth, JumpCloud.
- When to pick which (public demo vs internal vs enterprise SSO vs developer-org-restricted).
- Callback URL format for OAuth/OIDC: `https://<dataAppId>.hub.<keboolaConnectionHost>/_proxy/callback`.
- Basic auth password cannot be rotated — delete + recreate to change.
- MCP `modify_data_app` defaults to basic-auth for new apps; pass `authentication_type="default"` on update to keep existing setup (especially important for OIDC apps).
- Row-level data filtering by authenticated user is covered in `storage-access.md` (Permission scoping section), not here — that pattern is about data access, not auth itself.

### `references/duckdb-caching.md`
- **Why:** querying Snowflake on every page render is slow and costs credits. Cache once per N minutes in an in-memory DuckDB, query DuckDB for all subsequent requests.
- **When to use:** read-only apps where data refresh interval ≥ minutes. Skip for RW apps where every read must be current.
- **Pattern (Node, adapted from `kai-pricing-calculator-app`):**
  1. `init()` — create in-memory DuckDB, define table schemas.
  2. `refresh()` — pull from Snowflake (workspace query), write NDJSON to /tmp, `INSERT INTO ... FROM read_json_auto(...)`, transactional.
  3. `query(sql)` — run against DuckDB; convert BigInts to Numbers; ISO-date strings.
  4. Background interval (`setInterval`) for auto-refresh, plus an admin `/api/refresh` endpoint.
- **Pattern (Python):** analogous — `duckdb.connect(":memory:")`, `con.register("conversations", df)` after pulling from Snowflake; cache the refresh function with `functools.lru_cache` or a TTL wrapper.
- Reference template at `templates/duckdb-cache/`.

### `references/styling-guide.md`
- **Default look.** Take the FI app (`keboola-rnd/keboola-financial-intelligence-app`) and profitline-js-app conventions: Plus Jakarta Sans + JetBrains Mono, Tailwind utility classes, shadcn/ui base components, a single `COLORS` constant, formatters in `lib/constants.ts`.
- For Streamlit: default Keboola theme colors above + `general-design-guide` extras (logo placement, anchor-link hiding, footer pattern).
- **Brand customization.** If the customer has a brand kit, override via Tailwind theme (Python/JS) or `[theme]` in `config.toml` (Streamlit). Patterns inline.
- **Hook point:** if a "company-styling" skill or theme-factory exists, this reference points to it as the place to customize.
- No emoji in dashboard UI elements (FI/profitline convention).

### `references/dashboard-patterns.md`
- SQL-first: aggregate in the database, never load raw data into the app.
- Sidebar global filters as session state — pattern from agent-usage-data-app.
- Per-page module pattern (`page_modules/`) for multi-page Streamlit dashboards.
- Charts: Plotly for Streamlit, ECharts (via `echarts-for-react`) or Chart.js for Python/JS frontends.
- Empty-state handling, loading states, no-layout-shift skeletons.
- Number/currency/percent formatting through a single helper (avoid `toFixed` scattered across components).
- Numeric columns must stay numeric for table sorting; use column config for currency display in Streamlit's `st.dataframe`.

### `references/kai-integration.md`
- Optional Kai chat embed inside the app via `kai-client` library (`github.com/keboola/kai-client`).
- Authentication into Kai using the same project token.
- Minimal embed pattern. **Note:** the library is still in development; treat this reference as a stub until APIs settle. Link to upstream README from inside the file rather than copying patterns that may change.

### `references/dev-workflow.md`
- **Prerequisite pointer:** first-time local-dev setup (install, run, secrets) lives in `streamlit-apps.md` (Streamlit) or `python-js-apps.md` (Python/JS). This reference assumes the agent already has a local server running.
- The validate → build → verify loop, preserved from the current `dataapp-dev` skill but condensed.
- Validate: `mcp__keboola__get_table`, `mcp__keboola__query_data`, `mcp__keboola__get_project_info`.
- Build: SQL-first, centralized `data_loader`, session state initialization, no variable conflicts.
- Verify (when possible): point Playwright MCP at the already-running local server, screenshot, click filters, check console.
- One-page checklist at the bottom.
- Optional — if the agent is in Claude Desktop without Playwright access, skip the verify step but require the agent to call out that visual verification was skipped.

### `references/troubleshooting.md`
- "Cannot POST /" / "Method Not Allowed" — Keboola POSTs to `/` on startup; handle both methods.
- "externally-managed-environment" / PEP 668 — replace `pip install` with `uv sync`; ensure `pyproject.toml` exists.
- WebSocket blank page (Streamlit/Dash) — add Nginx upgrade headers.
- Streaming responses arrive all at once — `proxy_buffering off; proxy_cache off;` on the SSE/WebSocket location.
- App won't start / restart loop — check absolute paths, `uv run` prefix, executable `setup.sh`, no `[program:nginx]`.
- Port mismatch local vs Keboola.
- Exit code 153 — locked git commit no longer in remote (force-push); reset state or push the commit back.
- Workspace ID prefix issue (`WORKSPACE_<id>`) — strip prefix as `kai-pricing-calculator-app/api/keboola-client.js` does.
- 500 from missing env var — add as `dataApp.secrets` in the config and redeploy.

## Templates

Each template directory contains a minimum-viable runnable starter:

### `templates/streamlit/`
- `streamlit_app.py` — one-page app with sidebar filter, calls `data_loader.execute_aggregation_query`.
- `pyproject.toml` — minimal: streamlit, pandas, plotly, requests.
- `.streamlit/secrets.toml.example` — `KBC_URL`, `KBC_TOKEN`, `KBC_WORKSPACE_ID`.
- `utils/data_loader.py` — `execute_aggregation_query(sql) -> DataFrame`, `get_table_name(table_id) -> str`, basic `@st.cache_data` wrapper.

### `templates/python-app/`
- `app.py` — Flask app, `app.route("/", methods=["GET", "POST"])`, internal port 5000.
- `pyproject.toml` — flask, requests; `requires-python = ">=3.11"`.
- `keboola-config/nginx/sites/default.conf` — `:8888 → :5000`.
- `keboola-config/supervisord/services/app.conf` — `uv run python /app/app.py`.
- `keboola-config/setup.sh` — `uv sync`.

### `templates/nodejs-app/`
- `server.js` — Express app, `app.all('/')`, internal port 3000.
- `package.json` — express; `"type": "module"`.
- `keboola-config/nginx/sites/default.conf` — `:8888 → :3000`, with WebSocket upgrade headers commented in.
- `keboola-config/supervisord/services/app.conf` — `node /app/server.js`.
- `keboola-config/setup.sh` — `npm install`.

### `templates/duckdb-cache/`
- `python/cache.py` — adaptation of the Node pattern to Python: `init()`, `refresh()`, `query(sql)`, status dict.
- `nodejs/duck.js` — slimmed-down version of `kai-pricing-calculator-app/api/duck.js` (the schema-specific bits stripped out, kept as a generic refresh-from-Snowflake-into-DuckDB harness).

## Plugin metadata changes

- `plugins/dataapp-developer/.claude-plugin/plugin.json` — bump version (1.1.0 → 1.2.0).
- `.claude-plugin/marketplace.json` — bump matching entry to 1.2.0.
- `plugins/dataapp-developer/README.md` — rewrite the "Available Skills" section to list `dataapp-development` (replacing the two old entries). Update plugin structure tree.
- Root `README.md` — update the Data App Developer Plugin feature list to mention the single skill and the new coverage areas.

## Cross-cutting design rules

1. **Every reference file starts with a one-sentence "Use this when…" line.** This is the agent's load-decision signal.
2. **Never duplicate connection-docs content.** Link to `help.keboola.com/data-apps/...` and surface the agent-actionable bits only.
3. **Templates are runnable.** Each is a complete, deployable scaffold the agent can copy into a new repo wholesale.
4. **Decision tree in `SKILL.md` does not require reading any reference.** Routing decisions must be possible from `SKILL.md` alone.
5. **No checklists or QA gates that don't fit the client path.** The Playwright-verify step is conditional: only when the client has filesystem access and a local server is running.

## Open questions / risks

- **Streamlit deprecation timing.** The skill treats both types as first-class today but should add a "Streamlit will be deprecated; prefer Python/JS for new builds" hint once a date is known. Currently flagged in `choosing-app-type.md` without a date.
- **Kai integration.** `kai-client` is still WIP. The reference is a stub that points upstream; this is intentional, not a gap.
- **Permission scoping by user.** No platform-level support yet. The `X-Kbc-User-Email` header workaround is documented in `authentication.md` and `storage-access.md` with a clear "this is a workaround" call-out.
- **MCP-managed git for Python/JS apps.** Currently a placeholder subsection in `python-js-apps.md`. Will be split out into its own reference once the platform support lands and the section grows past ~50 lines.

## Acceptance criteria

The consolidation is complete when:

1. `plugins/dataapp-developer/skills/dataapp-development/` exists with `SKILL.md`, the 12 references, and 4 template directories listed above.
2. `plugins/dataapp-developer/skills/dataapp-dev/` and `plugins/dataapp-developer/skills/dataapp-deployment/` are deleted.
3. Plugin version is bumped in both `plugin.json` and `marketplace.json`.
4. Plugin `README.md` and root `README.md` reflect the new single-skill structure.
5. `claude plugin validate .` passes from the repo root.
6. Each reference file opens with a "Use this when…" line.
7. Each template directory contains a minimum-viable runnable scaffold.
8. The `SKILL.md` decision tree routes correctly for every combination of {app type} × {client path} × {task}.
