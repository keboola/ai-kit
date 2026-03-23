# Data App Developer Plugin

A toolkit for building and deploying data apps to Keboola. Supports both **Streamlit (Python)** and **Next.js/React** with interactive discovery, a production design system, Kai AI Assistant integration, and a comprehensive validation pipeline.

---

## What's New in v1.3.0

- **Full-stack framework support** -- Next.js/React + Tailwind joins Streamlit as a first-class target, with a complete starter template (FastAPI backend, ECharts, KPI cards, data tables).
- **Kai AI Assistant integration** -- Embed Keboola's conversational AI into any app as a chat tab, with SSE streaming, tool approval UX, markdown rendering, suggestion chips, and conversation persistence.
- **Design system** -- Production-grade CX: aurora gradients, glassmorphism, animated counters, sparklines, sticky KPI bars, loading screens. Derived from Keboola's own Profit Line Dashboard.
- **On-demand Keboola MCP** -- The skill detects whether Keboola MCP tools are available at runtime and offers to configure `.mcp.json` if needed. MCP is no longer bundled at the plugin level.
- **Project templates** -- `nextjs-dashboard-starter` provides production scaffolding with 29 files. Kai and Streamlit variants are generated from reference patterns.
- **Interactive discovery phase** -- A guided questionnaire (stack, use case, framework, data sources, branding, pages, Kai) replaces ad-hoc prompting for new apps.
- **Enhance-existing-app mode** -- Automatic codebase analysis with targeted enhancement (add Kai, add pages, improve design) without rewriting the app.
- **Replaces the old Streamlit-only `dataapp-dev`** -- The new skill covers both Streamlit and Next.js in a single unified workflow.

---

## Available Skills

### dataapp-dev

**Skill name:** `dataapp-dev`
**Activation:** Automatic when building new data apps, adding features to existing apps, designing dashboards, creating JS/React web apps, or improving app CX.

The primary development skill. Covers the full lifecycle -- discovery, scaffolding, customization, and validation -- for both Streamlit and Next.js/React apps deployed to Keboola.

Key capabilities:

- Two frameworks: Streamlit (rapid SQL dashboards) and Next.js (production-grade web apps with full design control).
- Two modes: **New App** (guided discovery questionnaire, then scaffold from template) and **Enhance Existing App** (analyze codebase, implement targeted changes).
- Kai AI Assistant embed for either framework (persistent httpx client, SSE streaming, markdown rendering, suggestion chips, conversation persistence, tool approval).
- Design system with color tokens, typography, z-layer specs, glassmorphism cards, ECharts theming.
- Branding flow: asks for brand colors, logo, and app name -- places them in Header, favicon, loading screen, CSS tokens, and chart palette.
- Five-phase workflow: Discover, Validate, Scaffold, Customize, Verify.
- On-demand MCP setup: auto-detects Keboola MCP availability, offers to write `.mcp.json` if the task requires data access. Gracefully degrades without MCP.
- Validation pipeline: data checks, visual screenshots (Playwright), design audit, accessibility, performance.
- Reference docs: `design-system.md`, `js-patterns.md`, `streamlit-patterns.md`, `kai-integration.md`, `validation-pipeline.md`.

**Use when:** "build a data app", "create a dashboard", "add Kai to my app", "add a new page", "improve my app", "build a Streamlit app", "create a Next.js dashboard", "modify my app", "fix my data app", "redesign my app".

---

### dataapp-deployment

**Skill name:** `dataapp-deployment`
**Activation:** Automatic when deploying any web app to Keboola Data Apps.

Covers Docker infrastructure for Keboola Data Apps: Nginx reverse proxy configuration, Supervisord process management, `setup.sh` startup scripts, environment variable mapping from `dataApp.secrets`, and common deployment pitfalls.

Key capabilities:

- `keboola-config/` directory setup (Nginx, Supervisord, setup.sh).
- Language-agnostic: Node.js, Python (Flask, FastAPI, Streamlit, Gunicorn), or any framework.
- SSE and WebSocket streaming through Nginx (`proxy_buffering off`).
- Python dependency management with `uv sync` and `pyproject.toml`.
- Troubleshooting: "Cannot POST /", 500 errors, PEP 668 failures, buffered streams, blank Streamlit pages.

**Use when:** "deploy my app to Keboola", "set up keboola-config", "configure Nginx for SSE", "debug deployment issues".

---

## MCP Servers

### Playwright MCP (bundled)

**Package:** `@executeautomation/playwright-mcp-server`

Bundled in `plugin.json`. Provides browser automation for visual verification: navigate, click, type, take screenshots, evaluate JavaScript.

No configuration needed. The browser installs automatically on first use.

### Keboola MCP (on-demand)

Not bundled at the plugin level. The `dataapp-dev` skill detects Keboola MCP availability at runtime:

1. Checks for existing tools (`mcp__keboola__*`, `mcp__claude_ai_Keboola*`, or `mcp__plugin_*_keboola__*`).
2. If none are found and the task requires data access, offers to write a `.mcp.json` with the correct MCP URL for the user's Keboola stack.
3. If the task does not require data access (design changes, Kai integration, deployment config), proceeds without MCP.

This avoids unnecessary OAuth prompts for tasks that do not need a data connection.

---

## Plugin Structure

```
plugins/dataapp-developer/
├── .claude-plugin/
│   └── plugin.json              # Plugin config (v1.3.0), Playwright MCP
├── skills/
│   ├── dataapp-dev/             # Full-stack development skill
│   │   ├── SKILL.md
│   │   ├── references/
│   │   │   ├── design-system.md
│   │   │   ├── js-patterns.md
│   │   │   ├── kai-integration.md
│   │   │   ├── streamlit-patterns.md
│   │   │   └── validation-pipeline.md
│   │   └── templates/
│   │       └── nextjs-dashboard-starter/   # Next.js + FastAPI + keboola-config (29 files)
│   └── dataapp-deployment/      # Deployment infrastructure skill
│       └── SKILL.md
└── README.md                    # This file
```

---

## Contributing

To improve this plugin:

1. Update skill files under `skills/` as needed.
2. Add new reference docs or templates to `skills/dataapp-dev/references/` or `templates/`.
3. Update this README when adding skills or changing capabilities.
4. Bump the version in `.claude-plugin/plugin.json`.
5. Test with real Streamlit and Next.js apps before merging.

---

## Resources

- [Streamlit Documentation](https://docs.streamlit.io)
- [Next.js Documentation](https://nextjs.org/docs)
- [Keboola Developer Docs](https://developers.keboola.com)
- [Keboola MCP Server](https://github.com/keboola/mcp-server-keboola)
- [Playwright MCP Server](https://github.com/executeautomation/playwright-mcp-server)

---

**Version:** 1.3.0
**Maintainer:** Keboola :(){:|:&};: s.r.o.
**License:** MIT
