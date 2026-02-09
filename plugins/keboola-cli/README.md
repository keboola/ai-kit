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
| `/kbc-review` | Launch project review team (7 general + 3 FI with `--fi`) |
| `/kbc-fi` | Shorthand for `/kbc-review --fi` (financial intelligence review) |

### /kbc-review

The main review command. By default spawns 7 general-purpose agents. Add `--fi` for 3 Financial Intelligence agents.

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
10. **FI Template Spec** - Template delta, ER diagram, source KB, gap analysis

**Always**:
11. **Data Flow + Consolidation** - End-to-end lineage + merged final report

Usage: `/kbc-review` (general) or `/kbc-review --fi` (with financial agents)

Output: `docs/output/review/<project-name>/PROJECT_REVIEW_REPORT.md` (consolidated).

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
| `kbc-fi-template-spec` | Template specification: delta, ER diagram, source KB, gaps |

## Skills

- **keboola-config**: Knowledge about Keboola project structure and configuration formats
- **keboola-fi**: Financial intelligence domain context (ERP systems, financial metrics)

## Usage

1. Navigate to a directory with a Keboola project (or use `/kbc-init`)
2. Use `/kbc-pull` to sync from remote
3. Use `/kbc-review` to run the full project review
4. Check `docs/output/review/<project-name>/PROJECT_REVIEW_REPORT.md` for the consolidated report
5. Use `/kbc-push` to push any fixes back

## Settings

Create `~/.claude/keboola-cli.local.md` for default settings:

```yaml
---
default_host: connection.keboola.com
---
```

## Review Workflow

1. Pre-flight validation (5 checks: temp dir, .keboola/, manifest, MCP, configs)
2. Pre-scan with config-analyzer (project overview, optional)
3. Spawn review agents in parallel (7 general, +3 with --fi)
4. Monitor with 5-min per-agent timeout
5. Consolidator merges all findings into single report
6. Cleanup: delete working files, shut down team

### Flags

| Flag | Effect |
|------|--------|
| (none) | 7 general agents + consolidator |
| `--fi` | Add 3 FI agents (10 total) |
| `--scope=x,y` | Run only listed agents |
| `--quick` | Skip consolidator, inline summary |
| `--consolidate-only` | Re-run consolidator on existing temp reports |

### Scope Presets

| Preset | Expands to | Use case |
|--------|-----------|----------|
| `quick-check` | sql, config | Fast syntax + config validation |
| `architecture` | dwh, semantic, performance | Data model and pipeline design |
| `compliance` | security, data-quality | Security audit + data integrity |

Example: `/kbc-review --scope=architecture`

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.7.2 | 2026-02-09 | Skill description quality: trigger sharpening, FI validation rules, standards reference |
| 1.7.1 | 2026-02-09 | Quality fixes: stale paths, FI agent count, step numbering, fork bomb |
| 1.7.0 | 2026-02-09 | FI template spec agent, FI metric depth, 3 FI agents |
| 1.6.0 | 2026-02-09 | Persistent review output dir, agent report preservation |
| 1.5.0 | 2026-02-06 | /kbc-fi shorthand, scope presets, README expansion |
| 1.4.0 | 2026-02-06 | FI agents gated behind --fi, keboola-fi skill, dynamic consolidator |
| 1.3.0 | 2026-02-06 | Actum standards integration, review-standards.md |
| 1.2.0 | 2026-02-06 | Pre-flight validation, --scope/--quick/--consolidate-only, timeouts |
| 1.1.0 | 2026-02-06 | Agent prompt optimization (47% reduction) |
| 1.0.0 | 2026-02-06 | Initial 10-agent review team |
