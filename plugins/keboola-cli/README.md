# Keboola CLI Plugin

Claude Code plugin for managing and reviewing Keboola projects.

## Prerequisites

- [Keboola CLI](https://developers.keboola.com/cli/) installed and in PATH
- Keboola Storage API token (Master token)
- Keboola MCP server configured (for review agents)

## Installation

The plugin is already enabled in this project. To verify:

```bash
cat .claude/settings.json | grep enabledPlugins
```

You should see `"keboola-cli@fiia-plugins": true`.

## Commands (slash commands)

Type these directly in Claude Code:

| Command | Description |
|---------|-------------|
| `/kbc-init` | Initialize a new Keboola project locally |
| `/kbc-pull` | Pull configurations from remote project |
| `/kbc-push` | Push local changes to remote project |
| `/kbc-diff` | Show differences between local and remote |
| `/kbc-review` | Launch the full 10-agent project review team |

### /kbc-review

The main review command. Spawns 10 specialized agents that run in parallel to audit every dimension of a Keboola project:

1. **SQL Quality** - Anti-patterns, correctness, performance
2. **Configuration** - Best practices, completeness, naming
3. **DWH Architecture** - Data model, layering, naming conventions
4. **Data Quality** - NULLs, duplicates, freshness, referential integrity
5. **Financial Logic** - P&L, Balance Sheet, KPIs, COA mapping
6. **Semantic Layer** - Metric definitions, generation readiness
7. **Security** - Credentials, PII, access control, compliance
8. **Performance** - Job durations, SQL efficiency, parallelization
9. **Template Readiness** - Parameterization, mapping tables, generation blockers
10. **Data Flow + Consolidation** - End-to-end lineage + merged final report

Output: `docs/PROJECT_REVIEW_REPORT.md` (consolidated) + 10 individual reports in `docs/`.

## Agents

| Agent | Purpose |
|-------|---------|
| `kbc-sql-reviewer` | SQL quality and anti-pattern detection |
| `kbc-config-reviewer` | Configuration best practices |
| `kbc-dwh-architect` | Data warehouse architecture review |
| `kbc-data-quality-analyst` | Live data quality analysis via MCP |
| `kbc-financial-analyst` | Financial calculation validation (multi-ERP, SaaS metrics) |
| `kbc-semantic-layer-reviewer` | Semantic layer and metric definitions |
| `kbc-security-auditor` | Security audit (credentials, PII, compliance) |
| `kbc-performance-optimizer` | Pipeline performance and optimization |
| `kbc-template-readiness` | Template readiness for FIIA automation |
| `kbc-review-consolidator` | Data flow mapping + report consolidation |
| `keboola-config-analyzer` | General config analysis and explanation |

## Skills

- **keboola-config**: Knowledge about Keboola project structure and configuration formats
- **duckdb-transformation**: Expert knowledge for writing, optimizing, and migrating DuckDB transformations --- covers SQL dialect, block orchestration, dynamic backends, Parquet, case sensitivity, Snowflake migration, type casting patterns, and best practices
- **job-error-triage**: A disciplined triage loop for a single job/deploy/config-write failure --- read the error log first, one root-cause diagnosis, one proposed config diff, one gated write, then verify it applied before reporting success; replaces firing multiple speculative config writes

## Usage

1. Navigate to a directory with a Keboola project (or use `/kbc-init`)
2. Use `/kbc-pull` to sync from remote
3. Use `/kbc-review` to run the full project review
4. Check `docs/PROJECT_REVIEW_REPORT.md` for the consolidated report
5. Use `/kbc-push` to push any fixes back

## Settings

Create `~/.claude/keboola-cli.local.md` for default settings:

```yaml
---
default_host: connection.keboola.com
---
```
