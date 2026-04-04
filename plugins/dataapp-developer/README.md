# Data App Developer Plugin

A toolkit for building and deploying production data apps to Keboola using **Next.js (React + Tailwind)** with a **Python FastAPI backend**. Includes interactive discovery, a production design system, Keboola deployment configuration, and visual verification with Playwright.

---

## What's New in v3.6.0

- **KAI in Header, not NavTabs** — AI Assistant is accessed via ChatButton in the header (sidebar sheet), not a dedicated tab or /assistant route.
- **Table links to Keboola** — DataStatusBadge table names are clickable hyperlinks to Keboola Storage (correct URL format: bucket/overview/table/name/overview).
- **Health endpoint includes table_id** — Backend `/api/health` returns `table_id` per table for Storage link construction.
- **Pin to My Dashboard from KAI** — Fixed `isPinned`/`unpinByHeadersRows` in dashboard-storage. KaiTableChart pin button works correctly.
- **KAI context is app-scoped** — System context includes only tables loaded in the app, with full schemas, KPI formulas, and domain enumerations.
- **CUSTOMIZE checklist** — 2-pass priority structure (3 critical + 7 polish items) for reliable agent customization of kai-client files.
- **Zero hardcoded content** — All kai-client template files use generic defaults with `// CUSTOMIZE:` markers. No warehouse/demo/profitline references.
- **Header/NavTabs gap fix** — `.glass` CSS split: base class has no border-bottom, only `nav.glass` gets it. Never set `position: relative` on header/nav.
- **CSS border rules** — Never mix shorthand/longhand border properties. Draggable z-index capped at 10.
- **KaiTableChart enhanced** — Column sorting, bar/line chart modes, CSV export, 60% numeric threshold, area gradients.
- **Template deduplication** — `ChartShell` extracts shared drag/resize/snap/fullscreen logic. `useGroupedConversations` hook eliminates ChatHistory duplication. `isPinned` optimized with row-count pre-check.
- **Dependency comments** — All kai-client files that import from consumer-app paths list required dependencies in JSDoc.

## What's New in v3.5.0

- **Cross-agent health contract** — Backend agent now explicitly extends `/api/health` to return `tables_loaded` count and per-table details for the DataStatusBadge.
- **Template dependency accuracy** — My Dashboards reference no longer claims `react-markdown`/`remark-gfm` are in the starter template (they're KAI-only, handled by the KAI guide).
- **Favicon path consistency** — `app-patterns.md` Root Layout example now matches the template's `/keboola-icon.svg`.

## What's New in v3.4.0

- **Design file consolidation** — Merged `design-patterns.md` + `design-interactions.md` into `design-advanced.md`. Merged `kai-custom-dashboard.md` into `my-dashboards.md`.
- **My Dashboards reference** — New `my-dashboards.md` covers the full custom dashboard builder: chart builder with drag/drop field wells, chart library, multi-dashboard tabs, KaiTableChart, pin-from-KAI integration, and storage utilities.

## What's New in v3.3.0

- **KAI implementation guide** — Frontend agent fetches complete `KAI_IMPLEMENTATION_GUIDE.md` from keboola/kai-client (polling proxy architecture, not basic SSE).
- **Agent prompt templates** — Phase 3 and Phase 5 agent prompts in `agent-prompts.md`.
- **AI assistant reference trimmed** — `ai-assistant.md` is a lightweight pointer to the runtime-fetched guide, with key architecture notes and Nginx config.

---

## Skill: dataapp-developer

**Activation:** Automatic when building, enhancing, or deploying data apps to Keboola.

### 6-Phase Workflow

| Phase | Name | What happens |
|-------|------|-------------|
| 0 | Discover | Interactive questionnaire: use case, data sources, branding, pages |
| 1 | Validate | Verify data structures with Keboola MCP |
| 2 | Scaffold | Copy lean Next.js + FastAPI template |
| 3 | Customize | Parallel agents: backend (sonnet) + frontend (sonnet) |
| 4 | Deploy | Configure keboola-config (Nginx, Supervisord, setup.sh, secrets) |
| 5 | Verify | Visual validation with Playwright, data checks, accessibility |

### Key Capabilities

- Production design system: aurora backgrounds, glassmorphism, KPI cards with sparklines, animated counters, sticky bars, loading screens.
- Branding flow: asks for colors, logo, app name — applies to Header, favicon, CSS tokens, chart palette.
- My Dashboards: custom dashboard builder with chart builder, drag/drop field wells, always scaffolded.
- On-demand MCP: auto-detects Keboola MCP, offers to configure if needed.
- Optional AI Assistant via dynamic fetch from kai-client repository.
- Deployment troubleshooting: covers PEP 668, POST-to-root, SSE buffering, WebSocket failures.

### Reference Docs

| File | Content |
|------|---------|
| `design-tokens.md` | Color tokens, typography, number formatting, z-layers |
| `design-components.md` | Header, NavTabs, FilterBar, KPI Card, tables, empty states, branding, favicon |
| `design-charts.md` | ECharts/Recharts setup, Y-axis rules, tooltips, responsive heights |
| `design-advanced.md` | Advanced patterns + interactions: skeleton loaders, spacing, portals, URL filter state, accessible colors, error boundary, animations |
| `app-patterns.md` | Next.js architecture, React Query, FastAPI backend, SQL patterns |
| `deployment.md` | Keboola Docker: Nginx, Supervisord, env vars, errors, checklist |
| `mcp-setup.md` | MCP detection, stack configuration, `.mcp.json` setup |
| `validation.md` | Data, visual quality, design, accessibility, performance checks |
| `agent-prompts.md` | Ready-to-use prompt templates for Phase 3 (backend + frontend) and Phase 5 (verify+fix) agents |
| `ai-assistant.md` | KAI quick-reference (full guide fetched at runtime from keboola/kai-client) |
| `my-dashboards.md` | Custom dashboard: chart builder, field wells, chart library, KaiTableChart, storage utils |

**Use when:** "build a data app", "create a dashboard", "deploy to Keboola", "add a new page", "improve my app", "fix deployment", "configure Nginx".

---

## MCP Servers

### Keboola MCP (on-demand)

Not bundled. The skill creates a project-level `.mcp.json` during setup. Named `{project}-keboola`.

### Playwright MCP (on-demand)

Not bundled. The skill configures Playwright via `.mcp.json` at Phase 5 (verification) only when needed.

---

## Plugin Structure

```
plugins/dataapp-developer/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── dataapp-developer/
│       ├── SKILL.md
│       ├── references/
│       │   ├── agent-prompts.md
│       │   ├── ai-assistant.md
│       │   ├── app-patterns.md
│       │   ├── deployment.md
│       │   ├── design-advanced.md
│       │   ├── design-charts.md
│       │   ├── design-components.md
│       │   ├── design-tokens.md
│       │   ├── mcp-setup.md
│       │   ├── my-dashboards.md
│       │   └── validation.md
│       └── templates/
│           └── nextjs-dashboard-starter/
└── README.md
```

---

**Version:** 3.6.0
**Maintainer:** Keboola
**License:** MIT
