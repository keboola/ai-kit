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
| `/kbc-review` | Launch project review team (7 general + 2 FI with `--fi`) |

### /kbc-review

The main review command. By default spawns 7 general-purpose agents. Add `--fi` for Financial Intelligence agents.

**General Review Agents (default)**:
1. **SQL Quality** - Anti-patterns, correctness, performance
2. **Configuration** - Best practices, completeness, naming
3. **DWH Architecture** - Data model, layering, naming conventions
4. **Data Quality** - NULLs, duplicates, freshness, referential integrity
5. **Semantic Layer** - Metric definitions, generation readiness
6. **Security** - Credentials, PII, access control, compliance
7. **Performance** - Job durations, SQL efficiency, parallelization

**Financial Intelligence Agents (`--fi`)**:
8. **Financial Logic** - P&L, Balance Sheet, KPIs, COA mapping
9. **Template Readiness** - Parameterization, mapping tables, generation blockers

**Always**:
10. **Data Flow + Consolidation** - End-to-end lineage + merged final report

Usage: `/kbc-review` (general) or `/kbc-review --fi` (with financial agents)

Output: `docs/PROJECT_REVIEW_REPORT.md` (consolidated).

## Agents

### General Review Agents (default)

| Agent | Purpose |
|-------|---------|
| `kbc-sql-reviewer` | SQL quality and anti-pattern detection |
| `kbc-config-reviewer` | Configuration best practices |
| `kbc-dwh-architect` | Data warehouse architecture review |
| `kbc-data-quality-analyst` | Live data quality analysis via MCP |
| `kbc-semantic-layer-reviewer` | Semantic layer and metric definitions |
| `kbc-security-auditor` | Security audit (credentials, PII, compliance) |
| `kbc-performance-optimizer` | Pipeline performance and optimization |
| `kbc-review-consolidator` | Data flow mapping + report consolidation |
| `keboola-config-analyzer` | General config analysis and explanation |

### Financial Intelligence Agents (`--fi`)

| Agent | Purpose |
|-------|---------|
| `kbc-financial-analyst` | Financial calculation validation (multi-ERP, SaaS metrics) |
| `kbc-template-readiness` | Template readiness for project templatization |

## Skills

- **keboola-config**: Knowledge about Keboola project structure and configuration formats
- **keboola-fi**: Financial intelligence domain context (ERP systems, financial metrics)

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
