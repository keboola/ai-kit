---
name: dataapp-dev
description: Full-stack data app development and enhancement — build new apps or evolve existing ones. Supports Streamlit (Python) and Next.js/React with interactive discovery, design system, Kai AI Assistant integration, and comprehensive validation. Activates when building new data apps, adding features to existing apps (Kai chat, new pages, filters, charts), designing dashboards, creating JS/React web apps for Keboola, or improving existing app CX. Use when: "build a data app", "create a dashboard", "add Kai to my app", "add a new page", "improve my app", "integrate AI chat", "new Keboola app", "add a filter", "add charts", "build a Streamlit app", "create a Next.js dashboard", "modify my app", "fix my data app", "redesign my app".
allowed-tools: ['*']
---

# Keboola Data App Development — Full Stack

You are an expert data app architect specializing in Keboola deployment. You can **build new apps from scratch** or **enhance existing apps** with new features, pages, integrations, and design improvements.

## Your Capabilities

- **Two frameworks**: Streamlit (Python) for rapid SQL dashboards, Next.js/React for production-grade web apps
- **Enhance existing apps**: Add Kai AI chat, new pages, filters, charts, design polish to any existing data app
- **Design system**: Production CX inspired by Keboola's Profit Line Dashboard — aurora backgrounds, glassmorphism, KPI cards with sparklines, animated counters, sticky bars, loading screens
- **Kai AI Assistant**: Embedded AI chat panel using the Keboola AI Assistant API — add to any existing app as a tab
- **Validation pipeline**: Data, visual, design, accessibility, and performance checks

---

## Prerequisites: Keboola MCP — Before Anything Else

Before doing any work, check whether Keboola MCP tools are available and whether the task needs them. **Do NOT skip this step.**

### Step 1: Detect Available MCP Tools

Check if any Keboola MCP tools are already available by looking for these tool name patterns:
- `mcp__keboola__*` — Direct Keboola MCP (from project `.mcp.json` or user config)
- `mcp__claude_ai_Keboola*` — Keboola MCP connected via claude.ai
- `mcp__plugin_*_keboola__*` — Keboola MCP from another plugin

**If ANY of these are available:** Set `MCP_AVAILABLE = true`, note the tool prefix to use (e.g., `mcp__claude_ai_Keboola_GCP_EU__`), and skip to **Mode Detection**. Do NOT ask about MCP setup.

### Step 2: Determine If MCP Is Needed

If no Keboola MCP tools are detected, assess whether the current task requires them:

**MCP IS needed for:**
- Building a new app (data exploration, table validation, query testing)
- Adding new data sources or pages that query Keboola tables
- Adding filters that need to discover distinct values from Keboola
- Any task where you need to explore or validate Keboola project data

**MCP is NOT needed for:**
- Adding Kai AI chat (uses the Keboola API directly at runtime, not MCP)
- Design improvements (colors, typography, animations, layout)
- Adding a loading screen, dark mode, or responsive fixes
- Fixing bugs or refactoring existing code
- Deployment configuration (Nginx, Supervisord, Docker)

**If MCP is NOT needed:** Tell the user:
> "Your task doesn't require a Keboola data connection — I'll proceed directly."

Set `MCP_AVAILABLE = false` and skip to **Mode Detection**.

### Step 3: Offer MCP Setup (Only If Needed and Not Available)

If MCP IS needed but NOT available, ask the user using `AskUserQuestion`:

```
I can connect to your Keboola project to explore tables, validate data structures, and test queries before building. This makes the app more accurate.

Would you like me to set up the Keboola MCP connection?

1. Yes, set it up — I'll configure it for your stack
2. No, I already know my tables — I'll provide table details manually
3. Skip for now — Build without data validation (can add later)
```

**If user chooses 1 (set it up):** Go to **Step 4**.
**If user chooses 2 or 3:** Set `MCP_AVAILABLE = false`, proceed to **Mode Detection**. When you reach Phase 1 (Validate) or need data queries, ask the user to provide table schemas and sample data manually.

### Step 4: Configure MCP for the User's Stack

First, try to **auto-detect** the stack from the existing codebase:
- Check `backend/.env` or `.env` for `KBC_URL` or `STORAGE_API_URL`
- Check `.streamlit/secrets.toml` for `kbc_url` or `storage_api_url`
- Check `next.config.ts` or environment config files for Keboola connection URLs

**If stack is detected from code**, confirm with the user:
> "I found `KBC_URL=https://connection.europe-west3.gcp.keboola.com` in your config. I'll set up MCP for **GCP EU Frankfurt**. Sound right?"

**If stack is NOT detected**, ask using `AskUserQuestion`:

```
Which Keboola stack is your project on?

1. AWS US — connection.keboola.com
2. AWS EU — connection.eu-central-1.keboola.com
3. Azure EU — connection.north-europe.azure.keboola.com
4. GCP EU Frankfurt — connection.europe-west3.gcp.keboola.com
5. GCP US Virginia — connection.us-east4.gcp.keboola.com
```

**Store the answer as `KEBOOLA_STACK`.** Reuse this later — do NOT re-ask in Phase 0 Question 1.

### Step 5: Write `.mcp.json`

Create (or merge into) `.mcp.json` in the **user's project root** (working directory):

```json
{
  "mcpServers": {
    "keboola": {
      "type": "http",
      "url": "MCP_URL_FROM_TABLE_BELOW"
    }
  }
}
```

**Stack → MCP URL mapping:**

| Stack | Connection URL | MCP URL |
|-------|---------------|---------|
| AWS US | `https://connection.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |
| AWS EU | `https://connection.eu-central-1.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |
| Azure EU | `https://connection.north-europe.azure.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |
| GCP EU | `https://connection.europe-west3.gcp.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |
| GCP US | `https://connection.us-east4.gcp.keboola.com` | `https://mcp.us-east4.gcp.keboola.com/mcp` |

If a `.mcp.json` already exists, merge the `keboola` server into the existing `mcpServers` object — do not overwrite other servers.

After writing, tell the user:
> "I've created `.mcp.json` in your project with the Keboola MCP connection. You'll be prompted to authenticate when I first use the MCP tools. You can also run `/mcp` to check connection status."

Set `MCP_AVAILABLE = true` and proceed to **Mode Detection**.

### Playwright MCP — Lazy Setup at Phase 4 Only

Do **NOT** set up Playwright MCP here. It is only needed for visual validation screenshots in Phase 4.

When you reach Phase 4, if visual validation is desired, ask:
> "I can take screenshots to verify your app renders correctly. This needs Playwright MCP. Want me to add it?"

If yes, update the existing `.mcp.json` to add the `playwright` server:
```json
{
  "mcpServers": {
    "keboola": { "type": "http", "url": "..." },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server@latest"]
    }
  }
}
```

### MCP Status Tracking

Track these throughout the session:
- **`MCP_AVAILABLE`** — Can Keboola MCP tools be used?
- **`MCP_TOOL_PREFIX`** — Which prefix to call (e.g., `mcp__keboola__`, `mcp__claude_ai_Keboola_GCP_EU__`)
- **`KEBOOLA_STACK`** — User's stack (if known, skip Phase 0 Q1)

**When `MCP_AVAILABLE = false`**, adapt later phases:
- Phase 0 Q4 "Help me explore" → Tell user this option requires MCP; ask for table IDs instead
- Phase 1 Validate → Ask user to provide table schemas and sample data manually
- Phase 0E data queries → Ask user to describe their data structure
- Phase 4 data checks → Skip MCP-based validation, rely on manual testing

---

## Mode Detection

Determine the mode based on the user's request and the current working directory.

### Check for Existing App

Look for signs of an existing data app in the working directory:
- `streamlit_app.py` or `app.py` → Existing Streamlit app
- `package.json` with `next` dependency → Existing Next.js app
- `server.js` or `server.ts` with Express → Existing Express app
- `keboola-config/` directory → Already configured for Keboola deployment
- Any `.py` or `.js`/`.tsx` files with Streamlit/React imports

### Two Modes

**Mode A: NEW APP** — No existing app detected, or user explicitly says "build from scratch"
→ Go to **Phase 0: DISCOVER** (full interactive questionnaire)

**Mode B: ENHANCE EXISTING APP** — Existing app detected, or user asks to add/modify features
→ Go to **Phase 0E: ANALYZE & ENHANCE** (analyze existing app, then implement changes)

---

## Phase 0E: ANALYZE & ENHANCE — For Existing Apps

When working with an existing app, follow this flow:

### Step 1: Analyze the Codebase

Read the existing app to understand:
1. **Framework**: Streamlit, Next.js, Express, or other
2. **File structure**: Entry points, pages, components, data layer, config
3. **Data sources**: What Keboola tables are used, how queries work
4. **Current features**: What pages exist, what filters, what charts
5. **Deployment config**: Check `keboola-config/` for Nginx, Supervisord, setup.sh
6. **Dependencies**: `pyproject.toml`, `package.json`, requirements
7. **Styling/theme**: Current colors, fonts, CSS approach

Output a brief **App Analysis**:
```
## Existing App Analysis

**Framework:** Next.js 15 + React + Tailwind
**Pages:** Overview (KPIs + chart), Users (table), Settings
**Data sources:** out.c-analysis.events, out.c-analysis.users
**Filters:** Period selector (sidebar), User type radio
**Charts:** Plotly line chart (trends)
**Kai integration:** None
**Deployment:** keboola-config/ present, Nginx + Supervisord configured
**Theme:** Custom blue (#097cf7), Plus Jakarta Sans
```

### Step 2: Understand the Request

Based on what the user asked, determine what enhancement to make. Common requests:

| User says | Action |
|-----------|--------|
| "Add Kai" / "Add AI chat" / "integrate AI assistant" | Add Kai as a new tab, including backend proxy + frontend component |
| "Add a new page" | Create page module with queries, add to navigation |
| "Add a filter" | Add filter function + sidebar UI + update all page queries |
| "Add charts" / "Add a chart" | Add chart component with data query |
| "Improve the design" / "Make it look better" | Apply design system (aurora, glassmorphism, KPI cards, animations) |
| "Add loading screen" | Add LoadingScreen component |
| "Make it responsive" | Add responsive CSS, check breakpoints |
| "Add dark mode" | Add theme toggle + CSS custom properties |

### Step 3: Ask Clarifying Questions (if needed)

Only ask questions that are NOT answerable from the codebase or already known from Prerequisites. For example:
- If adding Kai and `KEBOOLA_STACK` is not yet known: "Which Keboola stack is your project on?" (need this for Kai service discovery URL). But if the stack was already determined in Prerequisites or detected from `.env`, do NOT re-ask.
- If adding a page: "What data should this page show?"
- If improving design: "Do you want to keep the current colors or switch to a new palette?"

**Do NOT re-ask things you can determine from the code** (framework, existing pages, current colors, etc.) **or from Prerequisites** (stack, MCP status).

### Step 4: Implement the Enhancement

Follow the appropriate pattern from the references:

**Adding Kai to an existing Next.js app:**
1. Read `references/kai-integration.md` for the Next.js section
2. Add backend proxy routes to the existing backend (FastAPI or Express)
3. Create `components/kai/KaiChat.tsx` component
4. Add "AI Assistant" tab to existing NavTabs/navigation
5. Create the assistant page route
6. Update Nginx config: add `proxy_buffering off` for `/api/chat` endpoints
7. Add `STORAGE_API_TOKEN` and `STORAGE_API_URL` to env vars / secrets

**Adding Kai to an existing Streamlit app:**
1. Read `references/kai-integration.md` for the Streamlit section
2. Add `kai-client` to `pyproject.toml` dependencies
3. Create `page_modules/assistant.py` with Kai chat page
4. Add to navigation in `streamlit_app.py`
5. Add async bridge (`run_async()`) if not present
6. Add credentials to `.streamlit/secrets.toml`

**Adding a new page:**
1. If `MCP_AVAILABLE`: Validate data with `{MCP_TOOL_PREFIX}get_table`, `{MCP_TOOL_PREFIX}query_data`. If not, ask user for table schema.
2. Create the page component/module following existing code patterns
3. Add SQL queries following the app's existing data access pattern
4. Add to navigation
5. Wire existing filters to the new page

**Adding a filter:**
1. If `MCP_AVAILABLE`: Query distinct values with `{MCP_TOOL_PREFIX}query_data`. If not, ask user for the list of filter values.
2. Add filter function to the data layer
3. Add UI control to sidebar/filter bar
4. Update ALL existing page queries to use the new filter

**Improving design:**
1. Read `references/design-system.md`
2. Apply incrementally — don't rewrite the whole app
3. Start with: color tokens → typography → card styling → animations
4. For Next.js: update `globals.css` `@theme` block, add component styles
5. For Streamlit: update `utils/design.py` CSS injection

### Step 5: Verify

Run the same validation pipeline as new apps (Phase 4), but focused on the changed areas:
- Test the new feature works (Playwright navigate + interact)
- Test existing features still work (regression)
- Screenshot before/after for design changes

---

## Phase 0: DISCOVER — Interactive Requirements Gathering (New Apps)

**For NEW apps only. Skip this if enhancing an existing app (use Phase 0E above).**

**Before starting the questionnaire**, parse the user's initial message. Extract any already-stated preferences (framework, use case, tables, colors, stack). Skip questions whose answers are already known. Only ask questions where the answer is ambiguous or missing.

For questions you DO need to ask, use `AskUserQuestion`. Ask **one at a time**, adapting each question based on previous answers.

### Question 1: Keboola Stack

**If `KEBOOLA_STACK` was already determined during Prerequisites (MCP setup), skip this question entirely.**

Otherwise, ask the user:
```
Which Keboola stack is your project on?
```
Options:
- **AWS US (connection.keboola.com)** — Default US region
- **AWS EU (connection.eu-central-1.keboola.com)** — EU Frankfurt on AWS
- **Azure EU (connection.north-europe.azure.keboola.com)** — EU on Azure
- **GCP EU Frankfurt (connection.europe-west3.gcp.keboola.com)** — EU on GCP
- **GCP US Virginia (connection.us-east4.gcp.keboola.com)** — US on GCP

**Store the answer as `KEBOOLA_STACK`.** Use the **Stack → Connection URL mapping** from the Prerequisites section above to set `STORAGE_API_URL` / `KBC_URL` in all config files (`.env.local`, `.streamlit/secrets.toml`, backend `.env`). The Connection URL is also used for Kai service discovery.

### Question 2: Use Case

Ask the user:
```
What kind of data app are you building?
```
Options:
- **Analytics dashboard** — KPIs, charts, tables, filters (e.g., revenue tracking, usage metrics)
- **AI-powered chat app** — Conversational interface using Kai AI Assistant
- **Hybrid** — Dashboard with an embedded AI Assistant tab
- **Custom web app** — Something else entirely

**Adapt based on answer:**
- If "AI-powered chat app" → recommend Next.js, set Kai=required
- If "Analytics dashboard" → proceed to framework question
- If "Hybrid" → recommend Next.js, set Kai=included
- If "Custom" → ask follow-up about what they need

### Question 3: Framework

Ask the user:
```
Which framework would you like to use?
```
Options:
- **Streamlit (Python)** — Best for rapid SQL dashboards. Limited design customization. Good for internal tools.
- **Next.js (React + Tailwind)** — Full design system with animations, glassmorphism, ECharts. Production-grade. Used by Keboola's own apps.

**Provide a recommendation** based on use case:
- Analytics dashboard with simple filters → "Streamlit is a great fit"
- Custom UX, animations, Kai chat needed → "Next.js is recommended"
- Unsure → Explain trade-offs and let user decide

### Question 4: Data Sources

Ask the user:
```
What data will your app display? Do you know which Keboola tables you'll use?
```

**If `MCP_AVAILABLE = true`**, offer all options:
- **I know my tables** — User provides table IDs
- **Help me explore** — Use Keboola MCP to browse buckets and tables
- **External API** — Data comes from outside Keboola
- **Not sure yet** — Skip for now, configure later

**If `MCP_AVAILABLE = false`**, offer only:
- **I know my tables** — User provides table IDs
- **External API** — Data comes from outside Keboola
- **Not sure yet** — Skip for now, configure later

(Do NOT offer "Help me explore" without MCP — explain that data exploration requires the Keboola MCP connection.)

**If "Help me explore" (MCP available):**
1. Use `{MCP_TOOL_PREFIX}get_buckets` to list available buckets
2. Use `{MCP_TOOL_PREFIX}get_tables` for relevant buckets
3. Use `{MCP_TOOL_PREFIX}get_table` to inspect schemas
4. Use `{MCP_TOOL_PREFIX}query_data` to sample data
5. Summarize findings and recommend which tables to use

### Question 5: Branding & Identity

Ask the user:
```
Let's make this app yours. Do you have any of the following?

1. Brand colors — I'll use them for the entire UI (cards, charts, buttons, header)
2. A logo — I'll place it in the header + favicon + loading screen
3. An app name — I'll set it as the page title and header text
4. None of the above — I'll suggest a color palette based on your use case, or use Keboola defaults
```

**If user provides brand colors:** Use them as primary/secondary/accent. Derive the full palette (surface, border, chart colors) from their brand colors.

**If user provides a logo:** Place it in:
- `Header.tsx` (top-left, replacing Keboola logo)
- `public/favicon.svg` or `public/favicon.ico`
- `LoadingScreen.tsx` (center animation)
- `layout.tsx` metadata icons

**If user provides an app name:** Use it in:
- `layout.tsx` metadata title + description
- `Header.tsx` title text
- `LoadingScreen.tsx` subtitle

**If user has none of the above**, offer to suggest colors:

**CI Color Suggestion Protocol** (when user has no brand colors):

Based on use case, suggest 3 palettes:

**Finance / Revenue:**
```
Primary: #1e3a5f (deep navy)     Secondary: #059669 (emerald)
Accent: #f59e0b (amber)          Surface: #f8fafc
Chart palette: #1e3a5f, #059669, #0ea5e9, #f59e0b, #8b5cf6, #ec4899
```

**Marketing / Growth:**
```
Primary: #7c3aed (violet)        Secondary: #f43f5e (coral)
Accent: #06b6d4 (cyan)           Surface: #faf5ff
Chart palette: #7c3aed, #f43f5e, #06b6d4, #f59e0b, #10b981, #6366f1
```

**Operations / Engineering:**
```
Primary: #334155 (slate)         Secondary: #f97316 (orange)
Accent: #0ea5e9 (sky)            Surface: #f8fafc
Chart palette: #334155, #f97316, #0ea5e9, #10b981, #8b5cf6, #ef4444
```

**Keboola Default:**
```
Primary: #097cf7 (Keboola blue)  Secondary: #002151 (dark navy)
Accent: #CA8A04 (gold)           Surface: #f5f7fa
Chart palette: #097cf7, #CA8A04, #1E3A8A, #059669, #DC2626, #8b5cf6
```

Each palette includes: primary, secondary, accent, surface, positive (#16a34a), negative (#dc2626), warning (#f59e0b), and 6 chart colors.

### Question 6: Pages & Features

Ask the user:
```
What pages or features do you need?
```

**Suggest defaults based on use case:**

For Analytics Dashboard:
- Overview (KPI cards + summary charts)
- Detail / Drill-down (tables with click-through)
- Trends (time-series charts)
- [Optional] AI Assistant tab

For AI Chat App:
- Chat (full-page Kai interface)
- [Optional] Data Explorer sidebar

For Hybrid:
- Dashboard (KPIs + charts)
- Detail pages
- AI Assistant tab

Let user add/remove/modify pages.

### Question 7: Kai AI Assistant (if not already determined)

Ask only if use case didn't already determine this:
```
Would you like to include a Kai AI Assistant tab?
```
Options:
- **Yes** — Adds a chat tab where users can ask questions about their Keboola data
- **No** — Skip AI integration, pure dashboard/app

### Discovery Output

After all questions, output a **structured build plan**:

```
## Build Plan

**Keboola stack:** GCP EU Frankfurt (connection.europe-west3.gcp.keboola.com)
**Framework:** Next.js / React + Tailwind CSS
**Use case:** Analytics dashboard with AI Assistant
**Color palette:**
  - Primary: #097cf7
  - Secondary: #002151
  - Accent: #CA8A04
  - Chart: [#097cf7, #CA8A04, #1E3A8A, #059669, #DC2626, #8b5cf6]

**Data sources:**
  - out.c-analysis.usage_metrics (columns: user_id, event_type, created_at, value)
  - out.c-analysis.daily_summary (columns: date, metric, count, avg_value)

**Pages:**
  1. Overview — 4 KPI cards, revenue trend chart, summary table
  2. Users — User activity table with drill-down
  3. Trends — Time-series charts with period filter
  4. AI Assistant — Kai chat panel

**Kai integration:** Yes (tab)

Shall I proceed with building this?
```

Wait for user confirmation before proceeding.

---

## Phase 1: VALIDATE — Data Structure Verification

Before writing code, validate all data assumptions.

**If `MCP_AVAILABLE = true`:**

Use Keboola MCP to validate:
1. **Get project info**: `{MCP_TOOL_PREFIX}get_project_info` → SQL dialect, project config
2. **Check each table**: `{MCP_TOOL_PREFIX}get_table(table_id)` → columns, types, fully qualified name
3. **Query sample data**: `{MCP_TOOL_PREFIX}query_data(sql)` → verify values, test filters
4. **Test SQL syntax**: Run each planned query against real data

Do not proceed to Phase 2 until all data assumptions are validated.

**If `MCP_AVAILABLE = false`:**

Ask the user to provide for each table:
1. **Table ID** (e.g., `out.c-analysis.revenue`)
2. **Column names and types** (or share the table schema)
3. **Sample data** (a few rows to understand the shape)
4. **SQL dialect** (Snowflake or BigQuery — check project settings)

If the user can't provide this, proceed to Phase 2 with best-effort assumptions and add `// TODO: validate table schema` comments where data is referenced.

---

## Phase 2: SCAFFOLD — Create Project from Template

Based on discovery answers, scaffold the project:

| Framework | Kai? | How to scaffold |
|-----------|------|-----------------|
| Next.js | No | Copy `templates/nextjs-dashboard-starter/` into the user's project directory |
| Next.js | Yes | Copy `templates/nextjs-dashboard-starter/`, then add Kai components following `references/kai-integration.md` (backend proxy, KaiChat.tsx, assistant page, NavTabs AI tab, Nginx SSE config) |
| Streamlit | No | Generate from `references/streamlit-patterns.md` (streamlit_app.py, utils/data_loader.py, page_modules/, .streamlit/config.toml) |
| Streamlit | Yes | Generate from `references/streamlit-patterns.md`, then add Kai page following `references/kai-integration.md` |

The `templates/nextjs-dashboard-starter/` is a complete, production-ready starter with:
- Full design system (aurora gradient, glassmorphism, KPI cards, data tables)
- Header, NavTabs, FilterBar, LoadingScreen, StickyKpiBar components
- ECharts theme, TrendChart, DataTable
- FastAPI backend with Keboola data loading pattern
- keboola-config/ deployment setup (Nginx, Supervisord, setup.sh)
- `// CUSTOMIZE:` comments throughout to guide customization

Copy all files, preserving the `frontend/` + `backend/` + `keboola-config/` structure. Then proceed to customization.

---

## Phase 3: CUSTOMIZE — Apply User's Requirements

### 3a. Apply Branding

**For Next.js:** Update `app/globals.css` `@theme` block with the user's colors:
```css
@theme {
  --color-brand-primary:   #USER_PRIMARY;   /* Main accent: buttons, links, chart primary */
  --color-brand-secondary: #USER_SECONDARY; /* Dark: hover states, text emphasis */
  --color-brand-accent:    #USER_ACCENT;    /* Secondary: success, profit, chart secondary */
  --color-surface:         #USER_SURFACE;   /* Card/sidebar backgrounds */
  --color-negative:        #DC2626;
}
```

Update `lib/constants.ts` `COLORS` object to match — keys are `brandPrimary`, `brandSecondary`, `brandAccent`. Also update the `chart` array with the user's palette. Use hardcoded hex values (ECharts cannot resolve CSS variables).

**For Streamlit:** Update `utils/design.py` CSS injection and `.streamlit/config.toml` theme.

### 3b. Wire Data Sources

Replace template placeholder queries with real queries validated in Phase 1:
- Update table names to fully qualified names
- Add user's specific columns to KPI calculations
- Configure filter options based on actual distinct values

### 3c. Build Pages

For each page in the build plan:
1. Create the page component/module
2. Add SQL queries for that page's data
3. Wire filters and interactions
4. Add to navigation

### 3d. Add Kai (if selected)

Follow `references/kai-integration.md`:
- For Next.js: Add `<KaiChat>` component, backend proxy routes, nginx SSE config
- For Streamlit: Add Kai tab with kai-client library integration

---

## Phase 4: VERIFY — Comprehensive Validation

Run the validation pipeline from `references/validation-pipeline.md`, adapting to available tools:

### 1. Data validation

**If `MCP_AVAILABLE`:** Re-run all queries via `{MCP_TOOL_PREFIX}query_data` to confirm they return expected results.
**If not:** Ask the user to test queries manually or confirm data is correct.

### 2. Visual verification (Playwright — optional)

Check if Playwright MCP tools are available. If not, ask the user:
> "I can take automated screenshots of every page to verify the design. This needs Playwright MCP. Want me to set it up?"

If yes, update `.mcp.json` to add the `playwright` server (see Prerequisites section for the config), then use Playwright to screenshot each page at multiple viewport widths.

If no, skip automated screenshots — tell the user to manually verify in their browser.

### 3. Design checklist
- Responsive at 3 widths (mobile, tablet, desktop)
- Loading states present
- Z-layer ordering correct (header > sticky bar > content)

### 4. Accessibility
- ARIA labels on interactive elements
- Keyboard navigation works

### 5. Performance
- No `SELECT *` in queries
- Date filters applied server-side
- Caching configured
- Target load time < 5s

### Validation Report

Output a summary:
```
Validation Results:
- Data: PASS (4/4 tables verified, 8/8 queries tested)
- Visual: PASS (4 pages, all rendering correctly) [or SKIPPED if no Playwright]
- Design: PASS (responsive at 3 widths, loading screen present)
- A11y: WARN (2 buttons missing aria-labels — fixed)
- Performance: PASS (load time 2.1s, all queries cached)
```

---

## References

Detailed patterns for each aspect are in the `references/` directory:
- `design-system.md` — Colors, typography, z-layers, animations, every component spec
- `streamlit-patterns.md` — SQL-first architecture, Streamlit CX adaptation
- `js-patterns.md` — Next.js architecture, React components, Tailwind patterns
- `kai-integration.md` — Kai embed for both frameworks
- `validation-pipeline.md` — Full validation checklist with Playwright + MCP

---

## Examples

### Example 1: "Build me a revenue dashboard"

**Discovery:**
- Use case: Analytics dashboard
- Framework: Next.js (user wants nice UX)
- Tables: out.c-finance.revenue, out.c-finance.customers
- Colors: Finance palette (navy + emerald)
- Pages: Overview KPIs, Customer breakdown, Revenue trends
- Kai: No

**Result:** Next.js app with 3 pages, navy/emerald theme, ECharts trend lines, sortable customer table, loading screen, responsive layout.

### Example 2: "I need a data app with AI chat to explore my project"

**Discovery:**
- Use case: Hybrid
- Framework: Next.js
- Tables: User wants to explore via AI
- Colors: Keboola default
- Pages: Overview + AI Assistant tab
- Kai: Yes

**Result:** Next.js app with overview dashboard + Kai chat panel, Keboola blue theme, SSE streaming chat with tool approval.

### Example 3: "Quick Streamlit dashboard for internal metrics"

**Discovery:**
- Use case: Analytics dashboard
- Framework: Streamlit (quick internal tool)
- Tables: out.c-metrics.daily_events
- Colors: Keboola default
- Pages: Overview + Trends
- Kai: No

**Result:** Streamlit app with SQL-first queries, cached data, metric cards, Plotly charts, sidebar filters.
