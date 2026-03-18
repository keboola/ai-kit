---
name: keboola-cli
description: This skill should be used when the user wants to review, audit, or sync a Keboola project. Triggers on "review project", "run kbc review", "pull project", "push changes", "diff configs", "init project", or Keboola CLI workflow. Provides a 7-agent review team (+ 3 optional FI agents with --fi) covering SQL, security, performance, config, DWH architecture, data quality, and semantic layer, plus sync commands (init, pull, push, diff).
allowed-tools: ['*']
---

# Keboola CLI Plugin

Manage and review Keboola projects using the CLI and a 7-agent review team (+ 3 optional FI agents with `--fi`).

## Commands

| Command | Description |
|---------|-------------|
| `/kbc-init` | Initialize a new Keboola project locally |
| `/kbc-pull` | Pull configurations from remote project |
| `/kbc-push` | Push local changes to remote project |
| `/kbc-diff` | Show differences between local and remote |
| `/kbc-review` | Launch project review team (7 general + 3 FI with `--fi`) |
| `/kbc-fi` | Shorthand for `/kbc-review --fi` (financial intelligence review) |

## Review Team

`/kbc-review` spawns 7 general agents by default. Add `--fi` for 3 Financial Intelligence agents.

**General Review Agents (default)**:
1. **SQL Reviewer** -- Anti-patterns, correctness, Snowflake-specific issues
2. **Config Reviewer** -- Naming, descriptions, mappings, best practices
3. **DWH Architect** -- Data model, layering, dimensional modeling, naming
4. **Data Quality Analyst** -- NULLs, duplicates, freshness, referential integrity (live MCP queries)
5. **Semantic Layer Reviewer** -- Metric definitions, completeness, auto-generation readiness
6. **Security Auditor** -- Credentials, PII, access control, GDPR/CCPA compliance
7. **Performance Optimizer** -- Job durations, SQL efficiency, incremental loading, parallelization

**Financial Intelligence Agents (`--fi`)**:
8. **Financial Analyst** -- P&L, Balance Sheet, KPIs, COA mapping, multi-ERP awareness
9. **Template Readiness Assessor** -- Parameterization, mapping tables, generation blockers
10. **FI Template Spec** -- Template delta, ER diagram, source knowledge base, gap analysis

**Always**:
11. **Consolidator** -- Data flow mapping + merged report from all reviewers

**Pre-scan**:
- **Config Analyzer** -- Project structure overview (runs before review agents)

For Financial Intelligence reviews, use `/kbc-review --fi`. See `skills/keboola-fi/` for FI domain context.

Output: Consolidated `docs/output/review/<project-name>/PROJECT_REVIEW_REPORT.md`.

## Prerequisites

- [Keboola CLI](https://developers.keboola.com/cli/) installed for sync commands
- Keboola MCP server configured for live data analysis (data quality, performance agents)
- Storage API token (Master token) for project access

