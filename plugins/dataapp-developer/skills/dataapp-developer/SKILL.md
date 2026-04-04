---
name: dataapp-developer
version: 3.6.0
description: >-
  Build and deploy production data apps to Keboola using Next.js (React + Tailwind)
  with a Python FastAPI backend. Use when building a data app, creating a dashboard,
  adding pages or charts, deploying to Keboola, fixing deployment issues, configuring
  Nginx, adding an AI assistant, or improving an existing Keboola data app.
---

# Keboola Data App Development

Build and deploy production data apps to Keboola. Next.js 15 + React 19 + Tailwind CSS 4 frontend with Python FastAPI backend, deployed via Docker with Nginx reverse proxy.

## Working Directory Context

This skill runs from the **user's project root** — the directory where their data app lives (or will live). All file writes and Bash commands target this directory. Reference files live inside the Claude plugin installation; resolve `SKILL_REFS_PATH` once before Phase 3:

```bash
SKILL_REFS_PATH=$(find ~/.claude/plugins -name "app-patterns.md" -path "*/dataapp-developer/*" -exec dirname {} \; 2>/dev/null | head -1)
```

Store the result in the Build Brief. All `{SKILL_REFS_PATH}` references below use this value.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 | UI framework |
| Charts | ECharts 5 or Recharts 2 | ECharts for complex dashboards; Recharts for simple (see design-charts.md) |
| Data fetching | @tanstack/react-query 5 | Cache, stale-while-revalidate |
| Animation | Framer Motion 11 | Page transitions, component animations |
| Tables | @tanstack/react-table | Sortable, filterable data tables |
| Icons | lucide-react | Consistent icon set |
| Backend | FastAPI (Python) | Data proxy, API endpoints |
| HTTP client | httpx / requests | Async streaming (httpx), bulk data loading (requests + pandas) |
| Deployment | Docker + Nginx + Supervisord | Keboola Data App platform |

---

## Reference File Loading — Performance

**The orchestrator does not read design/pattern reference files directly.** They are loaded exclusively by the specialized agents that need them — loading them in the orchestrator would consume context budget without benefit, since the orchestrator does not write frontend or backend code.

| Who reads | Files | When |
|-----------|-------|------|
| **Orchestrator** | `mcp-setup.md`, `deployment.md` | Prerequisites + Phase 4 only |
| **Backend agent** (Phase 3) | `app-patterns.md` (always) + `ai-assistant.md` (if AI Assistant: yes) | Included in agent prompt |
| **Frontend agent** (Phase 3) | `design-tokens.md` + `design-components.md` + `design-charts.md` + `my-dashboards.md` (always) + `KAI_IMPLEMENTATION_GUIDE.md` (if AI Assistant: yes) | Included in agent prompt |
| **Verification agent** (Phase 5) | `validation.md` + `design-components.md` | Included in agent prompt |

**Never read `design-advanced.md` during initial build.** Advanced patterns (portals, URL filter state, accessible colors) — only if the user explicitly requests them, or during Phase 0E (Enhance) for coherent feature additions.

**Model:** Use **sonnet** for the orchestrator and all agents — this skill is coordination + well-scoped code generation.

---

## Prerequisites: Keboola MCP Setup

Follow `{SKILL_REFS_PATH}/mcp-setup.md` for the complete setup flow. Summary:
- Do not use `mcp__claude_ai_Keboola*` — these are org-level connections that may point to a different project. Always use a project-level `.mcp.json` instead.
- If `.mcp.json` is missing: ask project name + stack → write `.mcp.json` → tell user to restart + `/mcp` → **STOP and wait**
- After confirmation: call `get_project_info` + `get_buckets`, present a brief summary
- Set `MCP_TOOL_PREFIX = mcp__{project_name}_keboola__` for ALL subsequent MCP calls

---

## Workflow Overview

The skill follows a 6-phase workflow:

| Phase | Name | Purpose |
|-------|------|---------|
| 0 | **Discover** | Interactive requirements gathering |
| 1 | **Validate** | Verify data structures with MCP |
| 2 | **Scaffold** | Copy production template |
| 3 | **Customize** | Apply branding, wire data, build pages |
| 4 | **Deploy** | Configure keboola-config for platform |
| 5 | **Verify** | Visual and data validation with Playwright |

---

## Mode Detection

Determine the mode from the user's request and working directory.

**Check for existing app:**
- `package.json` with `next` dependency → Existing Next.js app
- `keboola-config/` directory → Already configured for Keboola
- `backend/` with `main.py` or `app.py` → Existing Python backend

**Mode A: NEW APP** — No existing app, or user says "build from scratch"
→ Go to **Phase 0: Discover**

**Mode B: ENHANCE EXISTING APP** — Existing app detected, or user asks to add/modify features
→ Go to **Phase 0E: Enhance**

---

## Phase 0: Discover — Batch Requirements Gathering (New Apps)

**Skip this for existing apps (use Phase 0E below).**

Parse the user's initial message first. Extract any already-stated preferences (use case, app name, colors, AI assistant). **Only ask about what's missing.**

### Round 1: Single Batch Question

Ask ONE `AskUserQuestion` covering all unknowns at once. Skip any item already answered.

```
I'll build your Keboola data app. Please answer the questions that apply:

**1. What kind of app?**
   A) Analytics dashboard (KPIs, charts, tables, filters)
   B) AI chat app (conversational AI interface)
   C) Hybrid (dashboard + AI Assistant tab)
   D) Other — describe briefly

**2. App name + primary brand color** (I'll suggest a palette if not provided)
   e.g. "Revenue Dashboard, #097cf7"

**3. AI Assistant tab?** Yes / No

I'll scan your Keboola data immediately after to recommend pages.
```

See `{SKILL_REFS_PATH}/design-tokens.md` for CI color palette suggestions.

### Round 2: Data Scan + Page Confirmation

Immediately after Round 1, run the data scan (no user input needed):
1. `{MCP_TOOL_PREFIX}get_buckets` → list buckets
2. For each relevant bucket: `{MCP_TOOL_PREFIX}get_tables(bucket_ids: ["bucket.id"])` → all tables with columns + types

Then ask ONE more `AskUserQuestion` with findings + recommendation:

```
Here's what I found in your project:
- **{bucket}** — {table}: {N} cols, {N} rows ({key_cols})
- ...

**Recommended layout** based on your use case + data:
1. **{Page 1}** (/) — {KPIs from actual columns} + {chart type}
2. **{Page 2}** (/{slug}) — {description}

Options:
A) Use this layout — looks good, proceed
B) Add more pages — I want {extra pages}
C) Different layout — {my own structure}
```

### Discovery Output

After Round 2 confirmation, proceed to Phase 1. If "AI-powered" or "Hybrid" use case → set `AI Assistant: yes` in the Build Brief.

---

## Phase 0E: Enhance — For Existing Apps

### Step 1: Analyze the Codebase

Read the existing app:
1. **File structure**: Entry points, pages, components, data layer, config
2. **Data sources**: What Keboola tables are used, how queries work
3. **Current features**: Pages, filters, charts
4. **Deployment config**: Check `keboola-config/` for Nginx, Supervisord, setup.sh
5. **Dependencies**: `pyproject.toml`, `package.json`
6. **Styling**: Current colors, fonts, CSS approach

Output a brief analysis:
```
## Existing App Analysis

**Pages:** Overview (KPIs + chart), Users (table), Settings
**Data sources:** out.c-analysis.events, out.c-analysis.users
**Deployment:** keboola-config/ present, Nginx + Supervisord configured
**Theme:** Custom blue (#097cf7), Plus Jakarta Sans
```

### Step 2: Implement the Enhancement

Common requests and actions:

| User says | Action |
|-----------|--------|
| "Add AI chat" | Fetch guide from kai-client repo, add AI Assistant tab |
| "Add a new page" | Create page component with queries, add to navigation |
| "Add a filter" | Add filter UI + update all page queries |
| "Add charts" | Add ECharts component with data query |
| "Improve the design" | Apply design system from `{SKILL_REFS_PATH}/design-tokens.md` + `{SKILL_REFS_PATH}/design-components.md` + `{SKILL_REFS_PATH}/design-advanced.md` (patterns, interactions, accessibility) |
| "Add [any feature]" | Before writing code, read `{SKILL_REFS_PATH}/design-advanced.md` for coherent patterns (spacing, skeleton states, accessible colors, component interactions) |
| "Deploy to Keboola" | Configure keboola-config per `{SKILL_REFS_PATH}/deployment.md` |
| "Fix deployment" | Diagnose using error table in `{SKILL_REFS_PATH}/deployment.md` |

### Step 3: Verify

Run validation (Phase 5) focused on changed areas.

---

## Phase 1: Validate — Data Structure Verification

Use MCP to validate all data assumptions before writing code:

1. `{MCP_TOOL_PREFIX}get_project_info` → confirm SQL dialect (Snowflake vs BigQuery), project config
2. `{MCP_TOOL_PREFIX}get_tables(table_ids: [table_id])` → verify columns, types, fully qualified names for each selected table
3. `{MCP_TOOL_PREFIX}query_data(query_name: "label", sql_query: sql)` → run each planned query against real data, verify values and filters work
4. Test edge cases: empty results, null values, date ranges

Do not proceed to Phase 2 until all data assumptions are validated against the live project.

---

## Phase 2: Scaffold — Create Project from Template

Copy `templates/nextjs-dashboard-starter/` into the user's project directory.

The template is a lean shell with placeholder cards. It includes:
- **Frontend**: Next.js 15 + React 19 + Tailwind CSS 4 with bento grid placeholders and design tokens
- **Layout**: Header + NavTabs in a shared route group layout — all data components (KPI cards, charts, tables) are built during Phase 3 using patterns from `{SKILL_REFS_PATH}/design-components.md` and `{SKILL_REFS_PATH}/design-charts.md`
- **Backend**: FastAPI with production Keboola data loader (requests → Storage API, parallel download, local CSV fallback), user context from OIDC headers, router structure
- **Deployment**: keboola-config/ (Nginx, Supervisord, setup.sh)
- **`// CUSTOMIZE:`** comments throughout to guide customization

Copy all files preserving the `frontend/` + `backend/` + `keboola-config/` structure.

---

## Build Brief — Synthesize Before Phase 3

**After Phase 2 (scaffold) completes, fill in this compact template. This becomes the ONLY context passed to both parallel agents. Do NOT proceed to Phase 3 until the Build Brief is complete.**

```markdown
## Build Brief: {APP_NAME}

### Identity
- App name: {APP_NAME}
- SQL dialect: {Snowflake | BigQuery}
- MCP prefix: mcp__{PROJECT}_keboola__
- Project dir: {ABSOLUTE_PATH}
- Skill refs dir: {SKILL_REFS_PATH}

### Brand
- Primary: {HEX}  Secondary: {HEX}  Accent: {HEX}  Surface: #f8fafc
- Chart palette: [{HEX}, {HEX}, {HEX}, {HEX}, {HEX}, {HEX}]
- Logo: {path | "none — use /public/keboola-icon.svg"}

### Tables (validated Phase 1)
- {short_name}: {FULLY_QUALIFIED_ID} — cols: {col}({type}), {col}({type}) — ~{N} rows
  Samples: {col}: [{val}, {val}]
(one line per table)

### Pages
- Page 1: {name} (route: /) — KPIs: {label}(formula: {expr}), ...; charts: {type}; filters: {col}
- Page 2: {name} (route: /{slug}) — {description}
(one line per page)

### API Contract (backend MUST match exactly; frontend MUST consume exactly)
- GET /api/kpis?period= → { {key}: number, {key}_delta: number, description: string, formula: string, sources: string[] }
- GET /api/{slug}?period= → [{ {col}: type, ... }]
(one line per endpoint)

### SQL (validated, all queries tested in Phase 1)
- query_kpis: SELECT SUM("{col}") AS {key}, ... FROM "{db}"."{schema}"."{table}" WHERE "{date_col}" >= {period_expr}
- query_{slug}: SELECT ...
(one block per query)

### AI Assistant: {yes | no}
### My Dashboards: always (route: /custom)
```

The API Contract is the integration surface — backend writes to it, frontend consumes from it. No back-channel between agents needed.

---

## Phase 3: Customize — Parallel Agent Execution

**Spawn TWO agents simultaneously in a single response turn (both Agent tool calls at once). Do NOT write any code yourself — your job is to fill the Build Brief and coordinate.** `SKILL_REFS_PATH` must already be resolved (see Working Directory Context).

Read `{SKILL_REFS_PATH}/agent-prompts.md` for the exact prompt templates for both agents. Fill all `{...}` placeholders from the Build Brief before spawning.

### Agent 1 — Backend (model: sonnet)

Use the **Phase 3 — Backend Agent** template from `agent-prompts.md`. Fill in the Build Brief and skill refs path.

### Agent 2 — Frontend (model: sonnet)

Use the **Phase 3 — Frontend Agent** template from `agent-prompts.md`. Fill in the Build Brief and skill refs path.

### Integration Check (orchestrator, after both complete)

1. Grep `backend/services/data_loader.py` for `TABLE_IDS` — verify real IDs are present (not placeholder)
2. Grep `frontend/lib/api.ts` for each endpoint path from the API Contract — verify hooks exist
3. If mismatch: fix the specific file only (do NOT re-run full agents)
4. Grep `frontend/app/(dashboard)/custom/page.tsx` — verify My Dashboards page exists
5. Grep `backend/routers/query.py` for `/api/data-schema` — verify data schema endpoint
6. Grep `components/layout/NavTabs.tsx` for `/custom` — verify My Dashboards tab

---

## Phase 4: Deploy — Keboola Platform Configuration

Read `{SKILL_REFS_PATH}/deployment.md` for file templates (Nginx, Supervisord, setup.sh), environment variable rules, common errors, and the Deployment Checklist. Run through the full checklist before proceeding to Phase 5.

To deploy or check status via MCP: `{MCP_TOOL_PREFIX}deploy_data_app(action: "deploy", configuration_id: "…")` · `{MCP_TOOL_PREFIX}get_data_apps()` → list apps + URLs

---

## Phase 5: Verify

**Do not skip this phase or silently finish after Phase 4.** Verification is the only point where integration failures, data mismatches, and visual regressions surface — apps that skip it often ship broken in ways that aren't obvious until a real user opens them.

After Phase 4 (Deploy config), ask the user using `AskUserQuestion`:

```
The app is built and deployment config is ready. How would you like to verify it?
```
Options:
- **Test locally first** — I'll help you set up credentials and run the app on localhost before deploying
- **Deploy to Keboola and verify there** — Skip local testing, deploy to Keboola where credentials are auto-injected, then verify on the live URL

**Do NOT proceed without the user's choice.** Do NOT say "here's how to run it" and stop.

Verification runs the full pipeline from `{SKILL_REFS_PATH}/validation.md`.

### Stage A: Localhost Verification

Before deploying, verify the app works locally.

**A0. Local credentials setup:**
The backend needs `KBC_TOKEN` and `KBC_URL` to load data from Keboola. Ask the user:

> "To test locally, the backend needs your Keboola Storage API token. Would you like to set up local testing credentials?"

If yes:
1. Ask the user for their **Storage API Token** (they can find it in Keboola UI → Settings → API Tokens)
2. Write `backend/.env` with:
   ```
   KBC_TOKEN={user_provided_token}
   KBC_URL={connection_url_from_stack}
   DEV_USER_EMAIL={user_email_or_dev@localhost}
   ```
3. The backend's `python-dotenv` will load this automatically on startup
4. **Add `backend/.env` to `.gitignore`** if not already there (never commit tokens)

If no: **Skip Stage A entirely** — go straight to Stage B below (Deploy to Keboola), where credentials are injected automatically via `dataApp.secrets`.

**A1. Start the app locally — DO IT YOURSELF:**

Do NOT ask the user to start servers. Do NOT tell them to open a terminal. Run everything yourself:

1. Backend: `cd backend && uv sync && uv run uvicorn main:app --host 127.0.0.1 --port 8050` (use `run_in_background`)
2. Frontend: `cd frontend && npm install && NODE_OPTIONS="--no-experimental-webstorage" npx next dev --port 3000` (use `run_in_background`)
3. Wait 8 seconds, then verify: `curl -s http://127.0.0.1:8050/api/health && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000`

If either fails, debug and fix — don't ask the user. Common fixes: port in use → `lsof -ti:PORT | xargs kill`; missing deps → re-run `npm install` / `uv sync`.

**A2. Spawn Verification+Fix Agent — do not run Playwright yourself:**

Delegate ALL verification AND fixing to a single Sonnet agent. It runs checks, fixes every failing item, confirms fixes, then reports. Use the **Phase 5 — Verification + Fix Agent** template from `{SKILL_REFS_PATH}/agent-prompts.md`. Fill in the app context before spawning.

The verification agent auto-fixes all issues without prompting. If `OVERALL: PASS` → proceed. The agent should never report `NEEDS_MANUAL` — it must fix everything or explain why a specific item cannot be auto-fixed.

### After Stage A — Ask the User

After localhost verification passes, **always ask the user** using `AskUserQuestion`:

```
Localhost verification passed. Does everything look correct? Would you like to deploy to Keboola?
```
Options:
- **Yes, deploy to Keboola** — I'll help you set up a Git repo and deploy
- **Fix issues first** — Tell me what needs fixing
- **No, done for now** — Stop here, I can deploy later

If "Fix issues first": fix what the user describes, re-verify, ask again.
If "No": stop. Kill background servers. Done.

### Stage B: Deploy to Keboola

Follow the Automated Deployment steps (B1–B6) in `{SKILL_REFS_PATH}/deployment.md`. Required variables:
- `KBC_TOKEN` — read from `backend/.env`
- `KEBOOLA_STACK` — determines the Data Science API URL (table in deployment.md)
- `{project_name}` — used for the GitHub repo name and app slug

**SECURITY:** Verify `backend/.env` is in `.gitignore` before any `git add`. Never commit tokens.

Kill background servers when done.

---

## References

Detailed patterns in the `references/` directory:

- `agent-prompts.md` — Ready-to-use prompt templates for Phase 3 (backend + frontend) and Phase 5 (verify+fix) agents
- `design-tokens.md` — Color tokens, typography, number formatting, z-layers
- `design-components.md` — Header, NavTabs, FilterBar, KPI Card, tables, empty states, branding, favicon
- `design-charts.md` — ECharts/Recharts decision guide + setup, Y-axis rules, tooltips, responsive heights, aurora gradient, glassmorphism
- `design-advanced.md` — Advanced/on-demand patterns + interactions: skeleton loaders, spacing, card padding, text truncation, accessible colors, portals, URL filter state, error boundary, animations. Also loaded during Phase 0E (Enhance) for coherent feature additions
- `app-patterns.md` — Next.js architecture, React Query hooks, FastAPI backend, data fetching, SQL best practices, data schema + query endpoints
- `deployment.md` — Keboola Docker deployment: Nginx, Supervisord, setup.sh, env vars, troubleshooting, checklist
- `mcp-setup.md` — Keboola MCP detection, configuration, stack-to-URL mapping
- `validation.md` — Full validation checklist: data, visual (Playwright), design, accessibility, performance
- `ai-assistant.md` — KAI quick-reference (lightweight pointer; full guide fetched at runtime from keboola/kai-client KAI_IMPLEMENTATION_GUIDE.md)
- `my-dashboards.md` — Custom dashboard page: chart builder (drag/drop field wells, chart library), multi-dashboard tabs, KaiTableChart component, pin-from-KAI integration, dashboard-storage utility

---

## Examples

### Example 1: "Build me a revenue dashboard"

**Discovery:** Analytics dashboard, Finance palette (navy + emerald), tables: out.c-finance.revenue + customers, pages: Overview KPIs, Customer breakdown, Revenue trends. AI Assistant: No.

**Result:** Next.js app with 3 pages, navy/emerald theme, ECharts trend lines, sortable customer table, loading screen, responsive layout. Deployed to Keboola with keboola-config.

### Example 2: "Data app with AI chat to explore my project"

**Discovery:** Hybrid use case, Keboola default palette, pages: Overview + AI Assistant tab. AI Assistant: Yes.

**Result:** Next.js app with overview dashboard + AI chat panel (integrated via kai-client), Keboola blue theme, streaming chat. Full keboola-config deployment.
