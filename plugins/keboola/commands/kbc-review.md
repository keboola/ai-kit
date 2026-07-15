---
name: kbc-review
description: Launch the full 10-agent Keboola project review team
allowed-tools:
  - Task
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
  - TeamCreate
  - TeamDelete
  - SendMessage
  - Read
  - Write
  - Glob
  - Grep
  - Bash
argument-hint: "[project-directory]"
---

# Full Keboola Project Review

Launch a team of 10 specialized review agents to perform a comprehensive audit of a Keboola project. Each agent reviews a different dimension of the project and writes a report. The consolidator merges all findings into a single actionable report.

## Prerequisites

1. The project must be pulled locally (run `/kbc-pull` first if needed)
2. A `.keboola` directory must exist in the target directory
3. Keboola MCP tools must be available (storage API token configured)

If the argument specifies a directory, use that. Otherwise use the current directory.

## Team Structure

Create a team called `kbc-review` with the following agents and tasks:

### Review Agents (run in parallel)

| Agent | Type | Task | Report Output |
|-------|------|------|---------------|
| sql-reviewer | kbc-sql-reviewer | Review all SQL transformations for quality, anti-patterns, and correctness | `docs/review_sql_quality.md` |
| config-reviewer | kbc-config-reviewer | Review all component configurations for best practices and issues | `docs/review_configurations.md` |
| dwh-architect | kbc-dwh-architect | Assess data model architecture, naming, layering, and structure | `docs/review_data_model_architecture.md` |
| data-quality | kbc-data-quality-analyst | Analyze data quality: NULLs, duplicates, stale data, referential integrity | `docs/review_data_quality.md` |
| financial-analyst | kbc-financial-analyst | Validate financial logic: P&L, Balance Sheet, KPIs, budget comparisons | `docs/review_financial_logic.md` |
| semantic-reviewer | kbc-semantic-layer-reviewer | Review semantic layer: metric definitions, completeness, generation readiness | `docs/review_semantic_layer.md` |
| security-auditor | kbc-security-auditor | Audit security: credentials, PII, access control, compliance | `docs/review_security.md` |
| performance-optimizer | kbc-performance-optimizer | Analyze performance: job durations, SQL efficiency, incremental loading, parallelization | `docs/review_performance.md` |
| template-readiness | kbc-template-readiness | Assess template readiness: parameterization, mapping tables, generation blockers | `docs/review_template_readiness.md` |

### Consolidator (runs after all reviewers finish)

| Agent | Type | Task | Report Output |
|-------|------|------|---------------|
| consolidator | kbc-review-consolidator | Map data flow, then consolidate all 9 review reports into one actionable report | `docs/review_data_flow.md` + `docs/PROJECT_REVIEW_REPORT.md` |

## Execution Steps

### 1. Create the team

```
TeamCreate: team_name="kbc-review", description="Full Keboola project review"
```

### 2. Create all tasks

Create 10 tasks using TaskCreate:

**Task 1-9: Individual reviews** (no dependencies)
- Subject: "[Agent name] review"
- Description: "Run the [agent type] agent to review the project and write report to [output file]"
- These 9 tasks have NO dependencies and can run in parallel

**Task 10: Consolidation** (blocked by tasks 1-9)
- Subject: "Consolidate all review reports"
- Description: "Map data flow and merge all 9 review reports into docs/PROJECT_REVIEW_REPORT.md"
- Set `addBlockedBy` to all 9 review task IDs

### 3. Spawn all 9 review agents in parallel

Use the Task tool to spawn each review agent with:
- `subagent_type`: the agent type from the table above (e.g., "kbc-sql-reviewer")
- `team_name`: "kbc-review"
- `name`: the agent name from the table above (e.g., "sql-reviewer")
- `prompt`: "You are part of the kbc-review team. Complete your assigned review task. Read the project configs using Keboola MCP tools and local files. Write your report to the specified output file. When done, mark your task as completed."
- `run_in_background`: true

### 4. Wait for all 9 reviewers to finish

Monitor task completion. When all 9 review tasks are marked completed, proceed.

### 5. Spawn the consolidator

Use the Task tool to spawn the consolidator agent:
- `subagent_type`: "kbc-review-consolidator"
- `team_name`: "kbc-review"
- `name`: "consolidator"
- `prompt`: "You are the consolidator for the kbc-review team. All 9 review reports are now written. Start Phase 1 (data flow mapping), then execute Phase 2 (consolidation). Read all reports from docs/ and produce the final docs/PROJECT_REVIEW_REPORT.md. When done, mark your task as completed."

### 6. Report completion

When the consolidator finishes:
1. Read `docs/PROJECT_REVIEW_REPORT.md`
2. Present a summary to the user with:
   - Total issues found (by severity)
   - Top 5 most critical findings
   - Overall project health assessment
   - Link to the full report file

### 7. Clean up

After presenting results:
1. Send shutdown requests to all teammates
2. Call TeamDelete to clean up the team

## Error Handling

- If an agent fails, note which review is missing and proceed with consolidation of available reports
- If Keboola MCP tools are not available, inform the user to configure their storage API token
- If no `.keboola` directory exists, suggest running `/kbc-init` or `/kbc-pull` first
