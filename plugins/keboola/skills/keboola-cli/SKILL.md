---
name: keboola-cli
description: Use this skill for managing and reviewing Keboola projects. Activates when syncing project configs (init, pull, push, diff), running project reviews, analyzing SQL transformations, auditing security, assessing performance, validating financial logic, or evaluating template readiness. Covers the full Keboola CLI workflow and 10-agent review team.
allowed-tools: ['*']
---

# Keboola CLI Plugin

Manage and review Keboola projects using the CLI and a 10-agent review team.

## Commands

| Command | Description |
|---------|-------------|
| `/kbc-init` | Initialize a new Keboola project locally |
| `/kbc-pull` | Pull configurations from remote project |
| `/kbc-push` | Push local changes to remote project |
| `/kbc-diff` | Show differences between local and remote |
| `/kbc-review` | Launch the full 10-agent project review team |

## Review Team

`/kbc-review` spawns 10 agents in parallel to audit every dimension of a Keboola project:

1. **SQL Reviewer** -- Anti-patterns, correctness, Snowflake-specific issues
2. **Config Reviewer** -- Naming, descriptions, mappings, best practices
3. **DWH Architect** -- Data model, layering, dimensional modeling, naming
4. **Data Quality Analyst** -- NULLs, duplicates, freshness, referential integrity (live MCP queries)
5. **Financial Analyst** -- P&L, Balance Sheet, KPIs, COA mapping, multi-ERP awareness
6. **Semantic Layer Reviewer** -- Metric definitions, completeness, auto-generation readiness
7. **Security Auditor** -- Credentials, PII, access control, GDPR/CCPA compliance
8. **Performance Optimizer** -- Job durations, SQL efficiency, incremental loading, parallelization
9. **Template Readiness Assessor** -- Parameterization, mapping tables, generation blockers
10. **Consolidator** -- Data flow mapping + merged report from all 9 reviewers

Output: Individual reports in `docs/review_*.md` plus a consolidated `docs/PROJECT_REVIEW_REPORT.md`.

## Prerequisites

- [Keboola CLI](https://developers.keboola.com/cli/) installed for sync commands
- Keboola MCP server configured for live data analysis (data quality, performance agents)
- Storage API token (Master token) for project access

## ERP Systems Supported

Financial review agents understand data structures from:
- NetSuite (GL, journal entries, subsidiaries)
- SAP S/4HANA / BW (BKPF/BSEG, cost centers, profit centers)
- Oracle Fusion / EBS (GL segments, ledgers, subledger accounting)
- Microsoft Dynamics 365 (financial dimensions, main accounts)
- QuickBooks / Xero (simplified COA, class tracking)

## Financial Metrics Covered

- Core P&L + Balance Sheet (Revenue, COGS, EBITDA, Net Income, Working Capital)
- SaaS metrics (MRR, ARR, Churn, LTV, CAC, NRR, Rule of 40)
- Cash flow (Operating CF, Free CF, DSO, DPO, DIO, Cash Conversion Cycle)
- Budget variance (Actual vs Budget, Forecast accuracy, YoY/MoM growth)
