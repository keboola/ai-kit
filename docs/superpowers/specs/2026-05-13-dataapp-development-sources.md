# Sources consolidated into the `dataapp-development` skill

This file lists every source consulted during the consolidation of the new `dataapp-development` skill (commits on branch `feat/dataapp-development-skill`, May 2026). Maintained so the next iteration knows where the content came from and which sources are still authoritative vs superseded.

The skill's own design spec is at [`2026-05-13-dataapp-development-design.md`](./2026-05-13-dataapp-development-design.md). The implementation plan is at [`../plans/2026-05-13-dataapp-development.md`](../plans/2026-05-13-dataapp-development.md). This document is provenance only — it is not loaded by the skill at runtime.

## 1. Original brief

- **Obsidian vault note** that started the work: `/Users/esner/Documents/Obsidian Vault/AI/KAI Assistant/skills-rules/Data apps.md`. Spelled out the merge target (`dataapp-dev` + `dataapp-deployment` → single `dataapp-development`), the area split (deployment / storage / auth / styling / dev workflow / Kai / dashboards), the client-path matrix (MCP-only / Claude Code+FS / kbagent CLI), and the materials list below.
- **Linear task** [`AI-3147`](https://linear.app/keboola/issue/AI-3147/extend-data-app-development-skill-to-cover-full-lifecycle-storage-git) — full lifecycle scope.

## 2. Plugin's prior skill content (superseded — deleted in commit 19 of the implementation plan)

These were the canonical skills before the consolidation. Their content was unpacked into the new structure; references that follow the same shape are noted next to each.

- `plugins/dataapp-developer/skills/dataapp-dev/SKILL.md` (+ `QUICKSTART.md`, `best-practices.md`, `workflow-guide.md`, `templates.md`, `validation-checklist.md`) — Streamlit-only, validate → build → verify loop. Mostly preserved in [`references/dev-workflow.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/dev-workflow.md), [`references/streamlit-apps.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/streamlit-apps.md), and [`references/dashboard-patterns.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/dashboard-patterns.md).
- `plugins/dataapp-developer/skills/dataapp-deployment/SKILL.md` — Python/JS deployment (Nginx/Supervisord/Docker base image, secrets, POST-on-/). Re-shaped into [`references/python-js-apps.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/python-js-apps.md) and [`references/troubleshooting.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/troubleshooting.md).

## 3. Keboola code repos read directly

Everything in this section was read either via `gh api` against GitHub or via local clones under `/Users/esner/Documents/Prace/KBC/AI-TESTING/`. Specific files I inspected are noted; the parent repos are listed in [`references/glossary.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/glossary.md) for the agent's runtime use.

| Repo | Specific files / behaviour borrowed |
|---|---|
| [`keboola/mcp-server`](https://github.com/keboola/mcp-server) — local clone at `keboola-mcp-server/` | `src/keboola_mcp_server/resources/prompts/project_system_prompt.md` (canonical project guidance, semantic-layer workflow, branch FQN rules); `tools/data_apps.py` (the three MCP data-app tools, `{QUERY_DATA_FUNCTION}` placeholder mechanics, `authentication_type="default"` quirk, basic-auth default); `clients/query.py` (QueryServiceClient rejects `branch_id in ['default','main']`); `workspace.py` (Snowflake `execute_query` → `list[list[Any]]` shape via Query Service); `resources/data_app/qsapi_query_data_code.py` (Snowflake injected query function — Query Service flow, `connection.` → `query.` derivation, `list[list[str]]` rows); `resources/data_app/sapi_query_data_code.py` (BigQuery injected query function — Storage API workspace endpoint, rows as dicts of native types); `tools/project.py` (`ProjectInfo` schema with `branch_id`, `branch_name`, `is_development_branch`, later `workspace_id`). |
| [`keboola/data-app-python-js`](https://github.com/keboola/data-app-python-js) | `README.md` (entrypoint flow, env-var injection, secrets-export normalisation, multi-server patterns, git commit locking, dev-mode); `docs/bootstrap.md` (the bootstrap hook, `/app` contract). |
| [`keboola/query-service-api-python-sdk`](https://github.com/keboola/query-service-api-python-sdk) | `src/keboola_query_service/models.py` (`QueryResult.data: list[list[Any]]` — confirmed array-of-cells shape); `src/keboola_query_service/client.py`, `examples/basic_query.py`. Used to verify the SDK return-shape claim before adding the typed-row helper section to `storage-access.md`. |
| [`keboola/query-service-api-js-sdk`](https://github.com/keboola/query-service-api-js-sdk) | `src/types.ts` (`QueryResult.data: unknown[][]`, `Column.{name,type,nullable,length?}`); `src/client.ts` (`executeQuery`, `getJobResults`); `tests/client.test.ts` (test fixtures showing `type: "integer"` not `"fixed"` — used to scope the type-name claim). |
| [`keboola/kai-client`](https://github.com/keboola/kai-client) | `README.md` (CLI surface, `KaiClient.from_storage_api`); `examples/streamlit_app.py` (Streamlit embed pattern — async loop, tool-approval); `examples/js-dataapp/server.js` (Express SSE-proxy pattern). |
| [`keboola-rnd/kai-pricing-calculator-app`](https://github.com/keboola-rnd/kai-pricing-calculator-app/tree/nodejs-pricing-simulator) — `nodejs-pricing-simulator` branch | `api/duck.js` (DuckDB caching harness — `init/refresh/query/status`, NDJSON tmp-file insert pattern, single-flight refresh); `api/keboola-client.js` (workspace-ID `WORKSPACE_<id>` normalization, env-var fallback chain — borrowed for the nodejs-app template before the Query Service migration); `server.js` (single-Node + static dashboarding shape, `.streamlit/secrets.toml` local-secrets fallback); `CLAUDE.md` (tech-stack rationale for the lightweight dashboarding default). |
| [`keboola/profitline-js-app`](https://github.com/keboola/profitline-js-app) | `CLAUDE.md` (FastAPI + Next.js multi-server shape, `X-Kbc-User-Email` claim that the user later told me was unverified and that I removed). |
| [`keboola-rnd/keboola-financial-intelligence-app`](https://github.com/keboola-rnd/keboola-financial-intelligence-app) — `fi-demo` branch | `package.json` (Vite + React 18 + TS + shadcn + ECharts + TanStack Query + React Router + Lucide + Sonner + Framer Motion stack); `tailwind.config.ts` (`darkMode: "class"`, HSL CSS-variable token system, chart palette); `src/index.css` (the actual semantic / Keboola brand HSL values, dark-mode override block). Used for the "Heavier framework option (React + Vite)" section of [`references/styling-guide.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/styling-guide.md). |
| [`keboola-rnd/agent-usage-data-app`](https://github.com/keboola-rnd/agent-usage-data-app) — local clone at `agent-usage-data-app/` | `CLAUDE.md`, `streamlit_dashboard.py`, `page_modules/*.py`, `utils/data_loader.py`. Source of the Streamlit page-module + global-WHERE-clause-builder + `execute_aggregation_query` pattern that became [`references/dashboard-patterns.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/dashboard-patterns.md) and the `templates/streamlit/` skeleton. |
| [`padak/keboola_agent_cli`](https://github.com/padak/keboola_agent_cli) — local clone at `keboola_agent_cli/` | `plugins/kbagent/skills/kbagent/references/data-app-workflow.md` (the `kbagent data-app` command surface, gotchas, two-step dry-run flow). Referenced from [`references/deployment-paths.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/deployment-paths.md) Path C and the [`references/glossary.md`](../../../plugins/dataapp-developer/skills/dataapp-development/references/glossary.md). |

## 4. Connection documentation (Keboola Help)

Local clone at `/Users/esner/Documents/Prace/KBC/DOCS_KEBOOLA/connection-docs`. Specific pages read:

- `data-apps/index.md` (overview, deployment / app management, sleep + resume)
- `data-apps/streamlit/index.md` (Code vs Git deploy, base-image packages, theming, AgGrid Enterprise license, secrets.toml direct-upload vs repo-based)
- `data-apps/python-js/index.md` (the `keboola-config/` contract — nginx/supervisord/setup.sh)
- `data-apps/storage-access/index.md` (Storage Access toggle, `direct-grant`, ephemeral workspace lifecycle, `KBC_WORKSPACE_MANIFEST_PATH`)
- `data-apps/authentication/index.md` (None / Basic / OIDC / GitHub / GitLab / JumpCloud, callback URL format)
- `data-apps/general-design-guide/index.md` (Streamlit theming + logo + footer + anchor-link tricks)
- `data-apps/terminal-log-tab/terminal-log-tab.md` (log access UI)
- `data-apps/oidc/{auth0,google-cloud-platform,microsoft-entra-id,okta}/index.md` (provider setup hints)

## 5. External-team contribution

- **PR [`keboola/ai-kit#71`](https://github.com/keboola/ai-kit/pull/71) — `miro-AJDA-2519` branch** by a parallel team working on the same skill. Cross-referenced after the initial consolidation. Pulled in:
  - The "bucket stage doesn't restrict writes" clarification.
  - The Storage wrapper module pattern (`storage.py` Python class / `storage.ts` TS module with `select()` / `execute()`).
  - The validation module pattern (`validation.py` / `validation.ts`) + five rules of thumb for SQL values (numeric / date / categorical / free-text / UUID).
  - Streamlit `@st.cache_resource` for the Storage client.
  - Two Storage-Access-specific troubleshooting entries (`KeyError` on env var, `Insufficient privileges`).

  Three things in that PR we **explicitly did not pull**:
  - 2-segment FQN examples (we keep 3-segment with database prefix — required for Data Catalog linked tables).
  - `query-service.<stack>` hostname pattern (canonical form is `query.<stack>`).
  - 8-step manual local-dev walkthrough (would duplicate our env-vars section).

## 6. Companion skill (cross-referenced separately)

- **`/Users/esner/Documents/Prace/KBC/AI-TESTING/SKILLS/keboola-js-data-app`** (v1.1.0) — a separate JS-data-app scaffolder skill. Cross-referenced item-by-item. Several footguns adopted as confirmed by code or runtime evidence; others rejected after the user clarified misinformation. The 10-item walkthrough is captured in the conversation log; final outcomes:
  - **Adopted:** Query Service SDK return shape (cells-as-strings) + typed-row helper; `BRANCH_ID` numeric requirement; `KBC_TOKEN` is platform-injected (don't add to secrets); ErrorBoundary for React; observability/resilience patterns; `.env` / `.env.local` template wiring.
  - **Rejected:** "Don't hardcode the Snowflake database name" (we require the database prefix); the "two patterns" `query-service.` vs `query.` warning (only `query.<stack>` is canonical); the space-typo accommodation for `.env local`.

## 7. Live verifications

Source-of-truth checks made by calling live MCPs or running the resulting skill against real Keboola projects.

- **`mcp__claude_ai_Keboola_MCP_AWS_US__get_project_info` live call** — confirmed `branch_id` returns as integer (e.g. `510379`), `is_development_branch: false` on main, `branch_name: "Main"`. Drove the BRANCH_ID section's `get_project_info` recommendation over a hand-rolled `/v2/storage/dev-branches` call.
- **Three live test sessions in `data_app_testing/`** against the GCP-US Keboola stack (project 3047 / Chat Data Engineer Demo, kbagent alias `new-branches`):
  - Session `619e0dad-70e3-4b99-a262-094b5a1d5143` (test 1) — first build via claude.ai-hosted MCP on main, exit success in 4m / 15 tool calls. Validated the Path A flow.
  - Session `aa830c3d-7e57-4f96-b555-e23379cff53c` (test 2) — local MCP `keboola-test` pinned to dev branch 35403, `modify_data_app` correctly rejected by the platform. Confirmed the "data apps only run in main" rule fires.
  - Session `6b856018-3d65-415b-9f5d-b4e303afa731` — the failure that surfaced the legacy `/v2/storage/.../workspaces/<id>/query` 404. Drove the Query Service migration (commit `76ee160`).

Each test produced a coordinated commit that strengthened a specific rule:
  - Path A "don't pre-write a local source file" (`c7e355f`, later promoted to a hard rule `6674d5e` after recurrence in test 3).
  - "Pick one Keboola path per session" (`3c257df`, sharpened to enforce `which kbagent` ordering in `4a5c4b9`).
  - "For local-dev credentials: ASK the user, never scan" (`7dc846e`).
  - Migration from Storage API workspace-query to Query Service for Snowflake (`76ee160`); BigQuery's continued use of the legacy endpoint documented separately (`5e5dbc4`).

## 8. Anthropic / Claude Code platform sources

- **Claude Code documentation** for plugin / skill format, `.mcp.json` discovery, project-vs-user-vs-org MCP layering, slash commands (`/dataapp-development`), permission modes (`auto`, `bypassPermissions`).
- **`@anthropic-ai/superpowers`** skills used during the work itself: `brainstorming` (initial design), `writing-plans` (implementation plan), `subagent-driven-development` (executed the plan with per-task subagents + two-stage review).

## Maintenance note

If a source above changes meaningfully (e.g. the Keboola MCP server adds Path A support for Python/JS apps, the Query Service starts supporting BigQuery, kbagent gains a `data-app logs` command), grep the skill for related claims and reconcile. The skill's authority is the union of these sources — if they diverge, this file is the audit trail for which version any given paragraph was written against.
