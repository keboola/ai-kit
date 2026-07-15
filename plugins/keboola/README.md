# Keboola Plugin

A single, unified Claude Code plugin for working with Keboola. It consolidates
what used to be six separate plugins into one install, with every skill grouped
by area. Installing it enables all areas at once and wires up the Keboola MCP
server (and Playwright for browser automation).

> **Consolidation note:** this plugin replaces the former `component-developer`,
> `dataapp-developer`, `keboola-cli`, `keboola-git`, `powerbi-to-sl`, and
> `sl-toolkit` plugins. Skills, commands, and agents are unchanged — only the
> packaging is different. Skills stay flat under `skills/<skill-name>/` (their
> invocation names are preserved); the grouping below is documentation only.

## Areas & Skills

18 skills, grouped by area:

### Components — build production-ready Keboola Python components
- **`develop-component`** — develop Keboola Python components (extractors, writers, applications); incremental processing, API-client/architecture separation, Ruff code quality. Delegates UI work to `build-component-ui`.
- **`build-component-ui`** — configuration schemas (`configSchema.json`, `configRowSchema.json`), conditional fields, UI elements, sync actions, schema testing, Playwright UI tests.
- **`debug-component`** — debug components using Keboola MCP tools and local testing.
- **`test-component`** — unified testing: datadir tests, unit/mock tests, VCR functional tests (record real HTTP once, replay in CI without credentials), regression tests from platform debug output.
- **`review`** — single consolidated reviewer for code quality **and** backward compatibility (configSchema/Pydantic/sync-action/output-table/state-file stability), with anonymized telemetry impact.
- **`get-started`** — initialize new components from the cookiecutter template, with repo state detection.
- **`migrate-to-uv`** — migrate components from `requirements.txt`+pip to `pyproject.toml`+uv with Ruff, Python 3.13 Dockerfile, and CI updates.
- **`component-defaults`** — load the canonical Keboola component template files (Dockerfile, push.yml, build_n_test.sh, docker-compose.yml, pre-commit-config, pyproject.toml). Used internally by other skills for alignment.
- **`keboola-context`** — platform-level knowledge about how Keboola Connection executes components (config rows, state, parallelism, test-data layout).

### Data Apps — build and deploy Keboola Apps
- **`dataapp-development`** — full lifecycle for Streamlit and Python/JS apps: choosing an app type, deployment paths, storage access (RO workspace / RW Query Service / input mapping), authentication, DuckDB caching, styling, dashboard patterns, optional Kai chat, and the validate→build→verify dev workflow. Ships 14 topical references and 5 runnable templates.
- **`mcp-data-app`** — host any streamable-HTTP / FastMCP server (Keboola MCP as the worked example) as a private, single-tenant Keboola data app, with bearer and OAuth-shape auth and four deploy drivers.
- **`semantic-layer-usage`** — confirm a semantic model's physical columns (via Keboola MCP `get_table`) and use metric SQL verbatim before embedding any query, so display names are never mistaken for physical Storage identifiers.

### CLI — project management & review
- **`keboola-cli`** — manage and review Keboola projects via the CLI and a 10-agent review team; covers the full sync workflow and review orchestration.
- **`keboola-config`** — knowledge about Keboola project structure and configuration formats.
- **`duckdb-transformation`** — writing, optimizing, and migrating DuckDB transformations: SQL dialect, block orchestration, dynamic backends, Parquet, case sensitivity, Snowflake migration, type-casting patterns, best practices.

### Git — Keboola-managed Git (Forgejo) for data apps
- **`keboola-git`** — provision/find a managed repo, mint a one-time `git_clone_url`, raw clone/push, the ~15MB / HTTP 413 build-at-deploy recipe, and deploy + verify from logs. kbagent-CLI driven (ships no MCP server of its own).

### Power BI — migrate Power BI semantic models
- **`powerbi-to-sl`** — migrate an existing Microsoft Power BI semantic model (TMDL folder or per-table JSON) into a Keboola semantic layer model. Maps tables→semantic-dataset, measures→semantic-metric (DAX preserved verbatim), relationships→semantic-relationship; produces JSON ready to push via the semantic layer. Brownfield companion to the semantic-layer skill. Bundles `scripts/migrate.py`, `fixtures/`, and `tests/`.

### Semantic Layer — inspect / validate / build + conversational CRUD
- **`semantic-layer`** — inspect (`/sl-show`), validate (`/sl-validate`), and build (`/sl-build`) semantic models via the metastore API; add/edit/remove entities conversationally (no slash command needed). Deep validation against Snowflake schemas, cascade rename with rollback, multi-cloud (GCP/AWS/Azure).

## Commands

| Command | Area | Description |
|---|---|---|
| `/review` | Components | Code-quality + backward-compatibility review of a component |
| `/schema-test` | Components | Launch the interactive configuration-schema tester |
| `/generate-vcr-tests` | Components | Scaffold VCR-based functional tests |
| `/kbc-init` | CLI | Initialize a new Keboola project locally |
| `/kbc-pull` | CLI | Pull configurations from the remote project |
| `/kbc-push` | CLI | Push local changes to the remote project |
| `/kbc-diff` | CLI | Show differences between local and remote |
| `/kbc-review` | CLI | Launch the full 10-agent project review team |
| `/keboola-git-copy` | Git | Bidirectional GitHub ↔ Keboola-git source copy with size guard and scratch-branch safety |
| `/sl-show` | Semantic Layer | List datasets, metrics, relationships, constraints, and glossary terms |
| `/sl-validate` | Semantic Layer | Validate a model (add `--deep` for Snowflake schema checks) |
| `/sl-build` | Semantic Layer | Greenfield wizard: discover → analyze → generate → validate → push |

## Agents

**Component development (3):** `component-builder`, `ui-developer`, `tester`.

**CLI review team (11):** `kbc-sql-reviewer`, `kbc-config-reviewer`, `kbc-dwh-architect`,
`kbc-data-quality-analyst`, `kbc-financial-analyst`, `kbc-semantic-layer-reviewer`,
`kbc-security-auditor`, `kbc-performance-optimizer`, `kbc-template-readiness`,
`kbc-review-consolidator`, and the general-purpose `keboola-config-analyzer`.
`/kbc-review` spawns the review agents in parallel to audit SQL, configuration,
DWH architecture, data quality, financial logic, semantic layer, security,
performance, and template readiness, then consolidates a report.

## MCP Servers

| Server | Type | Purpose |
|---|---|---|
| `keboola` | remote HTTP | Project/data validation, live queries, telemetry (component review, data-quality/performance agents, semantic-layer-usage) |
| `playwright` | local npx | Browser automation for visual verification of data apps and UI schemas |

The `keboola` server points at `https://mcp.us-east4.gcp.keboola.com/mcp`.
Some commands/agents require MCP to be authenticated — run `/mcp` to
authenticate and configure if tools aren't available.

Areas that are CLI/token-driven rather than MCP-driven (CLI sync, Keboola Git,
Power BI migration, semantic-layer inspect/validate/build) don't require the MCP
server, but installing this plugin makes it available to them.

## Prerequisites (by area)

- **CLI**: [Keboola CLI](https://developers.keboola.com/cli/) on PATH + a Storage API (Master) token; Keboola MCP for the live-data review agents.
- **Git**: `kbagent` on PATH, project registered, a manage token in the environment for logs/password/delete.
- **Semantic Layer**: a Storage API token for show/validate/CRUD; `kbagent` additionally for `/sl-build` and `/sl-validate --deep`.
- **Data Apps**: Keboola MCP (and optionally Playwright) for the validate→build→verify loop.

## Structure

```
plugins/keboola/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── skills/                      # 18 skills, flat (skills/<skill-name>/SKILL.md)
│   ├── build-component-ui/
│   ├── component-defaults/
│   ├── dataapp-development/
│   ├── debug-component/
│   ├── develop-component/
│   ├── duckdb-transformation/
│   ├── get-started/             #   + evals/trigger-evals.json
│   ├── keboola-cli/
│   ├── keboola-config/
│   ├── keboola-context/
│   ├── keboola-git/
│   ├── mcp-data-app/
│   ├── migrate-to-uv/
│   ├── powerbi-to-sl/           #   + scripts/, fixtures/, tests/
│   ├── review/
│   ├── semantic-layer/
│   ├── semantic-layer-usage/
│   └── test-component/
├── commands/                    # 12 slash commands (all areas)
├── agents/                      # 14 agents (3 component + 11 CLI review)
└── tests/                       # semantic-layer skill/schema consistency tests
```

## License

MIT licensed, see the repository [LICENSE](../../LICENSE).
