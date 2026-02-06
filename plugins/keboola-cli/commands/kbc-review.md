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
argument-hint: "[project-directory] [--scope=agent1,agent2] [--quick] [--consolidate-only]"
---

# Full Keboola Project Review

Launch a team of 10 specialized review agents to perform a comprehensive audit of a Keboola project. Each agent reviews a different dimension and writes a concise findings report. The consolidator merges all findings into a single actionable report.

## Prerequisites

1. Project must be pulled locally (`/kbc-pull` first if needed)
2. A `.keboola` directory must exist in the target directory
3. Keboola MCP tools must be available (storage API token configured)

If the argument specifies a directory, use that. Otherwise use the current directory.

## Pre-flight Validation (mandatory -- run before spawning any agents)

Run these checks in order. If ANY check fails, stop immediately, report the specific error, and do NOT spawn agents.

| # | Check | How | Fail message |
|---|-------|-----|-------------|
| 0 | Clean stale temp dir | If `docs/.review_temp/` exists, delete it (leftover from previous failed run) | (no fail -- just clean up) |
| 1 | `.keboola/` exists | `Glob: .keboola/manifest.json` | "No .keboola/ directory found. Run `/kbc-init` or `/kbc-pull` first." |
| 2 | Manifest readable | `Read: .keboola/manifest.json` | "Cannot read .keboola/manifest.json. File may be corrupted." |
| 3 | MCP reachable | Call `mcp__keboola__get_project_info` | "Keboola MCP not reachable. Check your storage API token and network." |
| 4 | Project has configs | Call `mcp__keboola__get_configs` and verify non-empty result | "Project has no configurations. Nothing to review." |

All checks passed? Proceed to scope selection.

## Scope Selection

Parse the user's arguments for optional flags:

### `--scope=agent1,agent2,...`

Run only the listed agents instead of all 9. Valid scope keywords:

| Keyword | Agent type |
|---------|-----------|
| sql | kbc-sql-reviewer |
| config | kbc-config-reviewer |
| dwh | kbc-dwh-architect |
| data-quality | kbc-data-quality-analyst |
| financial | kbc-financial-analyst |
| semantic | kbc-semantic-layer-reviewer |
| security | kbc-security-auditor |
| performance | kbc-performance-optimizer |
| template | kbc-template-readiness |

Example: `/kbc-review --scope=sql,security` runs only sql-reviewer and security-auditor.

If `--scope` is not provided, run all 9 agents (default).

### `--quick`

Skip the consolidator agent entirely. When all selected reviewers finish, read their temp reports directly and present an inline summary to the user (severity counts + top findings from each report). Do NOT write `docs/PROJECT_REVIEW_REPORT.md`. Do NOT delete `docs/.review_temp/` (user may want to inspect individual reports).

Quick mode is automatic when `--scope` selects 1-2 agents.

### `--consolidate-only`

Skip reviewer agents. Read existing reports from `docs/.review_temp/` and run only the consolidator. Use this to retry consolidation after a previous failed run.

### Combined behavior

| Agents selected | Consolidator | Output |
|----------------|-------------|--------|
| All 9 (default) | Yes | `docs/PROJECT_REVIEW_REPORT.md` |
| 3+ with --scope | Yes | `docs/PROJECT_REVIEW_REPORT.md` |
| 1-2 with --scope | No (auto-quick) | Inline summary, temp reports preserved |
| Any + --quick | No | Inline summary, temp reports preserved |
| --consolidate-only | Yes (only) | `docs/PROJECT_REVIEW_REPORT.md` |

## Team Structure

Create a team called `kbc-review` with the following agents and tasks:

### Review Agents (run in parallel)

All agents write concise findings to `docs/.review_temp/` (temporary directory, cleaned up after consolidation).

| Agent | Type | Task | Temp Output |
|-------|------|------|-------------|
| sql-reviewer | kbc-sql-reviewer | Review all SQL transformations for quality, anti-patterns, and correctness | `docs/.review_temp/sql-reviewer.md` |
| config-reviewer | kbc-config-reviewer | Review all component configurations for best practices and issues | `docs/.review_temp/config-reviewer.md` |
| dwh-architect | kbc-dwh-architect | Assess data model architecture, naming, layering, and structure | `docs/.review_temp/dwh-architect.md` |
| data-quality | kbc-data-quality-analyst | Analyze data quality: NULLs, duplicates, stale data, referential integrity | `docs/.review_temp/data-quality.md` |
| financial-analyst | kbc-financial-analyst | Validate financial logic: P&L, Balance Sheet, KPIs, budget comparisons | `docs/.review_temp/financial-analyst.md` |
| semantic-reviewer | kbc-semantic-layer-reviewer | Review semantic layer: metric definitions, completeness, generation readiness | `docs/.review_temp/semantic-reviewer.md` |
| security-auditor | kbc-security-auditor | Audit security: credentials, PII, access control, compliance | `docs/.review_temp/security-auditor.md` |
| performance-optimizer | kbc-performance-optimizer | Analyze performance: job durations, SQL efficiency, incremental loading, parallelization | `docs/.review_temp/performance-optimizer.md` |
| template-readiness | kbc-template-readiness | Assess template readiness: parameterization, mapping tables, generation blockers | `docs/.review_temp/template-readiness.md` |

### Consolidator (runs after all reviewers finish)

| Agent | Type | Task | Final Output |
|-------|------|------|--------------|
| consolidator | kbc-review-consolidator | Map data flow (inline), consolidate all 9 temp reports, clean up temp dir | `docs/PROJECT_REVIEW_REPORT.md` |

## Execution Steps

### 1. Create the team

```
TeamCreate: team_name="kbc-review", description="Full Keboola project review"
```

### 1.5. Pre-scan with config-analyzer (skip if --quick)

Unless `--quick` is set, spawn the `keboola-config-analyzer` agent on sonnet to produce a project overview:
- `subagent_type`: "keboola-config-analyzer"
- `team_name`: "kbc-review"
- `name`: "pre-scanner"
- `prompt`: "Pre-scan this Keboola project. Write a concise project overview to docs/.review_temp/PROJECT_OVERVIEW.md including: component inventory (type, name, count), data flow summary (sources -> transformations -> destinations), bucket structure with table counts. Keep under 100 lines. Mark task completed when done."
- `model`: "sonnet"
- **Timeout: 90 seconds.** If it times out, proceed without the overview -- reviewers will fetch their own context.

Wait for pre-scanner to complete before spawning review agents.

### 2. Create temp directory and all tasks

First, create the temp directory and shared context file:
```bash
mkdir -p docs/.review_temp
```

Then create the shared context file for cross-agent findings:

Write `docs/.review_temp/SHARED_CONTEXT.md`:
```markdown
# Shared Context (cross-agent findings)

Agents: append cross-domain findings relevant to OTHER agents here.

| Agent | Finding | Relevant-to |
|-------|---------|-------------|
```

Then create tasks using TaskCreate:

**Task 1-9: Individual reviews** (no dependencies)
- Subject: "[Agent name] review"
- Description: "Run the [agent type] agent to review the project and write concise report to docs/.review_temp/[agent-name].md"
- These 9 tasks have NO dependencies and can run in parallel

**Task 10: Consolidation** (blocked by tasks 1-9)
- Subject: "Consolidate all review reports"
- Description: "Map data flow (inline), merge all 9 temp reports into docs/PROJECT_REVIEW_REPORT.md, then delete docs/.review_temp/"
- Set `addBlockedBy` to all 9 review task IDs

### 3. Spawn all 9 review agents in parallel

Use the Task tool to spawn each review agent with:
- `subagent_type`: the agent type from the table above (e.g., "kbc-sql-reviewer")
- `team_name`: "kbc-review"
- `name`: the agent name from the table above (e.g., "sql-reviewer")
- `prompt`: "You are part of the kbc-review team. If docs/.review_temp/PROJECT_OVERVIEW.md exists, read it first for project context. Complete your assigned review task using Keboola MCP tools and local files. Write your concise findings report to docs/.review_temp/[your-agent-name].md (compact table format, under 200 lines). After writing your report, read docs/.review_temp/SHARED_CONTEXT.md and append any cross-domain findings relevant to OTHER agents. Mark your task as completed."
- `run_in_background`: true

### 4. Monitor reviewers with timeout

Do NOT just wait indefinitely. Use a monitoring loop:

1. Check `TaskList` every 30 seconds
2. **Per-agent timeout: 5 minutes.** If an agent's task has been `in_progress` for > 5 minutes:
   - Mark the task completed with description appended: "(TIMED OUT)"
   - Send `shutdown_request` to the agent
   - Log which agent timed out
3. Continue monitoring until all reviewer tasks are completed (or timed out)
4. Record which agents completed successfully vs timed out

### 5. Spawn the consolidator (unless --quick)

If `--quick` flag is set or only 1-2 agents were selected: skip to step 6 (quick summary).

Otherwise:

1. **Backup previous report** (if exists):
   ```bash
   if [ -f docs/PROJECT_REVIEW_REPORT.md ]; then
     cp docs/PROJECT_REVIEW_REPORT.md "docs/PROJECT_REVIEW_REPORT.$(date +%Y%m%d_%H%M%S).md"
   fi
   ```
2. Spawn the consolidator:
   - `subagent_type`: "kbc-review-consolidator"
   - `team_name`: "kbc-review"
   - `name`: "consolidator"
   - `prompt`: "You are the consolidator for the kbc-review team. Review reports are in docs/.review_temp/. [List which agents completed and which timed out/failed]. Start Phase 1 (data flow mapping -- hold in memory). Phase 2: read all available temp reports AND docs/.review_temp/SHARED_CONTEXT.md for cross-agent findings. Phase 3: write single docs/PROJECT_REVIEW_REPORT.md, enriching merged findings with shared context. List any missing reviews in the report. Phase 4: delete docs/.review_temp/. Mark task completed."
3. **Consolidator timeout: 8 minutes.** If consolidator times out:
   - Preserve `docs/.review_temp/` (do NOT delete)
   - Tell user: "Consolidator timed out. Individual reports preserved in docs/.review_temp/. Retry with `/kbc-review --consolidate-only`."

### 6. Report completion

**Full mode** (consolidator ran):
1. Read `docs/PROJECT_REVIEW_REPORT.md`
2. Present summary: total issues by severity, top 5 critical findings, health assessment, link to report
3. Note any agents that timed out or failed

**Quick mode** (no consolidator):
1. Read each temp report from `docs/.review_temp/`
2. Present inline summary: severity counts per agent, top findings from each
3. Note: "Individual reports preserved in docs/.review_temp/. Run `/kbc-review --consolidate-only` for full consolidated report."

### 7. Clean up

After presenting results:
1. Send shutdown requests to all teammates
2. Call TeamDelete to clean up the team
3. In full mode, `docs/.review_temp/` is deleted by the consolidator
4. In quick mode, temp dir is preserved for user inspection

## Error Handling

- **Agent timeout**: mark timed-out, proceed with available reports (see step 4)
- **Consolidator timeout**: preserve temp dir, suggest `--consolidate-only` retry
- **MCP unreachable**: caught by pre-flight (step 0)
- **No .keboola dir**: caught by pre-flight (step 0)
- **Partial results**: consolidator lists missing reviews in report, proceeds with what's available
