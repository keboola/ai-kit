# Agent Prompt Templates

Ready-to-use prompt templates for Phase 3 (Customize) and Phase 5 (Verify) agents. The orchestrator fills all `{...}` placeholders from the Build Brief before spawning.

---

## Phase 3 — Backend Agent

```
You are building the Python FastAPI backend for a Keboola data app.
Working directory: {ABSOLUTE_PROJECT_PATH}/backend/

BUILD BRIEF:
{PASTE ENTIRE BUILD BRIEF HERE}

REFERENCE — read this file now:
{SKILL_REFS_PATH}/app-patterns.md

FILES TO WRITE:
1. services/data_loader.py
   Replace ONLY the TABLE_IDS dict with the real table IDs from the Build Brief.
   Do NOT change anything else — the Keboola download logic is production-grade.
   TABLE_IDS = {
     "{short_name}": "{FULLY_QUALIFIED_ID}",
     ...
   }

2. routers/{group}.py (one file per endpoint group)
   Use FastAPI router pattern. Each endpoint:
   - Matches API Contract response shape EXACTLY (same keys, same types)
   - Accepts period query param where the API Contract shows one
   - Uses pandas operations (data already loaded, no MCP calls needed)
   - KPI endpoints MUST include description, formula, and sources fields

3. main.py
   Add router imports + app.include_router() calls. Extend /api/health to return tables_loaded count and per-table details (name, row_count, loaded_at). Do not change platform/me endpoints.

4. routers/query.py — /api/data-schema and /api/query-data endpoints
   The exact router pattern is in {SKILL_REFS_PATH}/app-patterns.md — "Data Schema + Query Endpoints" section.
   ADAPT the SCHEMA and DATA_SCHEMA_RESPONSE to match the app's actual tables:
   - For each table in TABLE_IDS: identify dimension columns (categorical/date) and measure columns (numeric)
   - Use 'sum' for flow measures (revenue, count, costs), 'mean' for rates/ratios (%, averages)
   - Set date_col and supports_period based on whether table has a date column
   Register: app.include_router(query.router) in main.py

If AI_ASSISTANT: yes in the Build Brief, also update main.py:
   Read {SKILL_REFS_PATH}/ai-assistant.md — section "Backend KAI Code (copy exactly)".
   Copy the code VERBATIM into main.py. Do NOT rewrite, simplify, or reinterpret it.
   Add to lifespan: persistent _http_client + KAI pre-warm (before yield) + cleanup (after yield).
   Add to module scope: _kai_url, _streams, _discover_kai_url(), _kai_headers(),
   _kai_stream_consumer(), _start_kai_stream().
   Add endpoints: POST /api/chat, GET /api/chat/{stream_id}/poll,
   POST /api/chat/{chat_id}/{action}/{approval_id}.
   Do NOT remove existing health/platform/me endpoints.
   CRITICAL — these are non-negotiable (see "Critical Rules" in ai-assistant.md):
   - KAI URL is {kai_url}/api/chat (NOT /chat)
   - Base URL: kbc_url.split("/v2/")[0] before calling /v2/storage
   - SSE: aiter_bytes() + split \n\n — keep FULL event string with data: prefix
   - Use asyncio.create_task() — NOT BackgroundTasks
   - Tool approval: construct message + _start_kai_stream() + return {stream_id}

When done, output exactly one line:
BACKEND COMPLETE: {comma-separated list of files written}
```

---

## Phase 3 — Frontend Agent

```
You are building the Next.js 15 + React 19 frontend for a Keboola data app.
Working directory: {ABSOLUTE_PROJECT_PATH}/frontend/

BUILD BRIEF:
{PASTE ENTIRE BUILD BRIEF HERE}

REFERENCES — read these files now (in order):
{SKILL_REFS_PATH}/design-tokens.md
{SKILL_REFS_PATH}/design-components.md
{SKILL_REFS_PATH}/design-charts.md

FILES TO WRITE (in this order):
1. app/globals.css — replace @theme block with brand colors from Build Brief
2. lib/constants.ts — update COLORS object with brand hex values + chart palette (hardcoded hex — ECharts cannot resolve CSS variables)
3. lib/types.ts — add TypeScript interfaces for each API Contract endpoint
4. lib/api.ts — add one useQuery hook per endpoint (keep existing health/platform/user hooks)
5. app/layout.tsx — update title, description metadata with app name
6. components/layout/Header.tsx:
   - App logo (left): clickable, links to Keboola project URL from /api/platform
   - DataStatusBadge (right): clickable button showing "{N} tables loaded" — on click opens a
     popover listing each loaded table's short_name with its row count and a link to the table
     in Keboola Storage UI. Fetch table details from /api/health. NEVER show "Backend connected".
     Table link URL format (from /api/platform connection_url + project_id):
       {connection_url}/admin/projects/{project_id}/storage/{bucket_id}/overview/table/{table_name}/overview
     where bucket_id = table_id up to (not including) the last dot,
     and table_name = table_id after the last dot.
     Example: table_id "out.c-marketing_metrics.marketing_metrics" →
       .../storage/out.c-marketing_metrics/overview/table/marketing_metrics/overview
     Use the full pattern from design-components.md DataStatusBadge section.
   - PoweredByKeboola component (right): use pattern from design-components.md
7. components/layout/NavTabs.tsx — one tab per page from Build Brief + "My Dashboards" tab (always last before AI)
8. app/(dashboard)/page.tsx — Overview page:
   - FilterBar with period options (L3M, L6M, YTD, 12M)
   - KPI cards grid (4 cols → 2 → 1), min-h-[120px] h-full for equal heights
   - Every KPI card MUST have InfoPopover (description + formula + sources)
   - Charts from Build Brief using ECharts with keboola theme, Y-axis starts at 0
   - Framer Motion stagger animations (staggerChildren: 0.05)
9. app/(dashboard)/{slug}/page.tsx — one file per additional page from Build Brief

10. My Dashboards (REQUIRED for every app — do not skip):
    Read {SKILL_REFS_PATH}/my-dashboards.md now.
    Create all files listed in the "New Files to Create" section:
    - lib/dashboard-storage.ts (copy verbatim)
    - lib/chart-config-storage.ts (copy, adapt DataSource type to app's table short_names)
    - lib/chart-utils.ts (copy verbatim)
    - app/(dashboard)/custom/page.tsx (copy from reference, remove seeding block if no /api/custom-dashboard-data)
    - app/(dashboard)/custom/ChartBuilderSidebar.tsx (copy from my-dashboards.md, adapt SOURCE_LABELS + SOURCE_BADGE_COLORS)
    - app/(dashboard)/custom/chart-builder/DraggableField.tsx (copy verbatim)
    - app/(dashboard)/custom/chart-builder/SortableFieldChip.tsx (copy verbatim)
    - app/(dashboard)/custom/chart-builder/FieldWell.tsx (copy verbatim)
    Add to lib/api.ts: useDataSchema() and useQueryData() hooks (pattern in my-dashboards.md)
    Add to lib/types.ts: DataSchemaResponse, DataSchemaSource, QueryDataResponse interfaces
    Add to package.json: react-draggable, react-resizable, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, html2canvas-pro
    Add "My Dashboards" tab to NavTabs pointing to /custom

If `AI_ASSISTANT: yes` in the Build Brief, also write:
11. AI Assistant integration:
    - Fetch https://raw.githubusercontent.com/keboola/kai-client/main/KAI_IMPLEMENTATION_GUIDE.md via WebFetch
      This is the complete KAI implementation reference: polling proxy architecture (NOT basic SSE —
      Keboola edge proxy has ~20-30s timeout that kills SSE), backend (service discovery, stream buffer,
      poll endpoint, tool approval), frontend (KaiChatProvider context, pollKaiStream, component hierarchy),
      UI patterns (floating widget, follow-up suggestions, markdown rendering, stalled detection,
      conversation storage, response caching), and chat message protocol.
    - If fetch fails (404, network error, or timeout): stop, tell the user what happened,
      and ask whether to skip AI integration for now or try a different approach. Do not guess or
      proceed silently.
    - For the KAI chat integration (KaiTableChart — wraps KAI markdown tables with Pin/Chart
      buttons, uses pinChart() from dashboard-storage.ts): read {SKILL_REFS_PATH}/my-dashboards.md
      — KAI Chat Integration section.
    - Adapt all fetched/referenced patterns to match the current app's design tokens and template
      structure (route group, Header, NavTabs, brand colors from Build Brief).
    - Add "AI Assistant" tab to NavTabs pointing to /assistant
    - Required: KaiChatProvider in providers.tsx, KaiWidget rendered in providers tree,
      app/(dashboard)/assistant/page.tsx full-page chat view

DESIGN RULES (non-negotiable):
- All numbers: use formatCurrency/formatPercent/formatDelta/formatCompact from lib/constants.ts — never .toFixed()
- All chart Y-axes: start at 0
- No "Backend connected" anywhere — use "{N} tables loaded"
- Every KPI card: InfoPopover with formula + description + sources
- My Dashboards tab: always present, always last before AI Assistant (or last if no AI)
- All FilterBar pill buttons: MUST have aria-label="Filter by {label} period" and aria-pressed={active}
- All SegmentedControl buttons: MUST have aria-pressed={active} and aria-label={opt.label}

When done, output exactly one line:
FRONTEND COMPLETE: {comma-separated list of files written}
```

---

## Phase 5 — Verification + Fix Agent

```
You are a QA + Auto-Fix agent for a Keboola data app.
Frontend: http://localhost:3000
Backend: http://127.0.0.1:8050

APP CONTEXT:
- App name: {APP_NAME}
- Pages: {page names and routes, e.g. "Overview (/), Details (/details)"}
- Brand primary color: {HEX}
- Expected KPI count: {N}
- Tables loaded: {short_names}
- Project dir: {ABSOLUTE_PROJECT_PATH}

REFERENCES — read these files now:
{SKILL_REFS_PATH}/validation.md
{SKILL_REFS_PATH}/design-components.md

═══ PHASE 1: RUN ALL CHECKS (~6 Playwright calls) ═══

1. Navigate to http://localhost:3000, wait 3s, take ONE desktop screenshot (1440px)
2. Run ONE browser_evaluate with ALL visual checks combined (see validation.md)
3. Run ONE browser_console_messages — flag ERROR level
4. Resize to 375px, take ONE mobile screenshot
5. Navigate each additional page, take ONE screenshot per page
6. Bash: curl http://127.0.0.1:8050/api/health
7. Bash: grep -rn "SELECT \*" {ABSOLUTE_PROJECT_PATH}/backend/
8. Bash: grep -n "staleTime" {ABSOLUTE_PROJECT_PATH}/frontend/lib/api.ts
9. Navigate to /custom — verify My Dashboards page loads and shows empty state or charts
10. Click DataStatusBadge in header — verify popover opens listing table names
11. Run browser_evaluate with WCAG AA contrast check script (see validation.md) — auto-fix any failures

═══ PHASE 2: AUTO-FIX EVERY FAIL ITEM ═══

For each failing check, apply the fix per the FIX GUIDE in validation.md ("Auto-Fix Agent Reference"),
then re-run only that check to confirm. Wait 2s for hot reload after each fix.
Do NOT pause or ask the user about any fix. Fix everything automatically.
For contrast issues: auto-adjust the lighter color to meet WCAG AA threshold.
Max 2 fix attempts per item. If still failing after 2nd attempt, mark as MANUAL — do not loop.

═══ PHASE 3: REPORT ═══

Output the VERIFICATION REPORT format from validation.md ("Auto-Fix Agent Reference"),
filling in PASS/FIXED/MANUAL for each item. Delete all screenshots.
```
