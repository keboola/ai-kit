# Data App Developer Plugin

Toolkit for building and deploying Keboola Apps. Provides `dataapp-development`, which covers the full lifecycle (Streamlit and Python/JS app types, three client paths, storage access, authentication, styling, caching, dashboarding, Kai integration, dev workflow, troubleshooting) with 14 topical references and 5 runnable templates, plus `semantic-layer-usage` for grounding apps and queries in a semantic model without mistaking logical names for physical Storage identifiers.

## Available Skills

### dataapp-development

**Activation:** Automatic when working on Keboola Apps (Streamlit or Python/JS — building, deploying, debugging, migrating).

**What it covers:**

- Choosing an app type (Streamlit vs single Node + static vs combined Python+Node)
- Streamlit apps — Code/Git deployment, theming, secrets, AgGrid Enterprise
- Python/JS apps — `/app` contract, nginx + supervisord, single-Node dashboarding default, multi-server Python+Node when needed
- Three deployment paths — MCP-only (Claude Desktop), Claude Code + MCP, kbagent CLI
- Storage access — RO workspace (default), RW direct via Query Service, input mapping (legacy)
- Authentication — None / Basic / OIDC / GitHub / GitLab / JumpCloud
- DuckDB caching for read-only apps (Python and Node patterns)
- Styling — lightweight CDN-Tailwind default + heavier framework option, Streamlit theming
- Dashboard patterns — SQL-first, sidebar filters, charts, formatting, sortable tables
- Kai integration — optional natural-language assistant via `kai-client`
- Dev workflow — validate → build → verify loop with Keboola MCP and Playwright MCP
- Troubleshooting — POST/, PEP 668, WebSocket, streaming, port mismatch, exit 153, workspace ID prefix, missing env vars

**Templates included:**

- `templates/streamlit/` — Streamlit + Plotly + `data_loader`
- `templates/python-app/` — Flask Python/JS app with `keboola-config/`
- `templates/nodejs-app/` — single-Node dashboarding default (Express + CDN Tailwind + Chart.js)
- `templates/python-node-app/` — combined FastAPI + Express (modeled on profitline)
- `templates/duckdb-cache/` — Node + Python harness for in-memory query caching

**Use cases:**

- Build a new Keboola App from scratch
- Add features to an existing app (filters, pages, metrics)
- Deploy or redeploy via MCP, kbagent, or push-and-redeploy
- Debug deployment or runtime issues
- Migrate between app types

### mcp-data-app

**Activation:** Automatic when hosting an MCP server as a private, single-tenant Keboola data app.

**What it covers:**

- Hosting any streamable-HTTP / FastMCP server as a dedicated remote MCP endpoint — Keboola MCP is the built-in worked example
- Two client-auth patterns — static bearer and OAuth-shape (claude.ai, Kai)
- Four deploy drivers — kbagent, keboola-git managed repos, hosted MCP tools (incl. Kai), manual Keboola UI fallback

See `skills/mcp-data-app/SKILL.md` for the full workflow.

### semantic-layer-usage

**Activation:** Automatic when building an app, query, report, or transformation from a Keboola semantic layer / semantic model, or right after a semantic-context tool returns.

**What it covers:**

- The semantic layer already carries the physical mapping (`semantic-dataset` `tableId`/`fqn`, `semantic-metric` SQL) — the business-facing display names are labels, not physical columns
- The one rule the MCP system-prompt workflow doesn't spell out: confirm the real columns via Keboola MCP (e.g. `get_table` on the dataset's `tableId`) and use the metric SQL verbatim before embedding any query
- A worked example of the failure it prevents (dashboard built from semantic display names ≠ physical columns in `out.c-nyc-aggregations-duckdb.rpt_*`)

## MCP Servers

| Server | Type | Purpose |
|---|---|---|
| Keboola | remote SSE | Project/data validation, query execution |
| Playwright | npx | Browser automation for visual verification |

## Plugin Structure

```
plugins/dataapp-developer/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── dataapp-development/
│   │   ├── SKILL.md          # router
│   │   ├── references/       # 14 topical references
│   │   └── templates/        # 5 runnable starter templates
│   ├── mcp-data-app/
│   │   ├── SKILL.md          # router
│   │   ├── reference/        # 4 deployment and auth references
│   │   ├── scripts/          # scaffold.sh
│   │   └── template/         # MCP server starter template
│   └── semantic-layer-usage/
│       └── SKILL.md          # confirm physical columns before querying
└── README.md
```

## Version

1.5.0

## Maintainer

Keboola :(){:|:&};: s.r.o. — `support@keboola.com`

## License

MIT
