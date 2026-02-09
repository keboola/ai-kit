---
name: kbc-review
description: Launch the Keboola project review team (7 general agents, + 3 FI agents with --fi)
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
argument-hint: "[project-directory] [--scope=agent1,agent2] [--quick] [--consolidate-only] [--fi]"
---

# Full Keboola Project Review

Launch a team of specialized review agents to audit a Keboola project. By default, 7 general-purpose agents run. Add `--fi` to include 3 Financial Intelligence agents (financial-analyst, template-readiness, fi-template-spec). The consolidator merges all findings into a single actionable report.

## Prerequisites

1. Project must be pulled locally (`/kbc-pull` first if needed)
2. A `.keboola` directory must exist in the target directory
3. Keboola MCP tools must be available (storage API token configured)

If the argument specifies a directory, use that. Otherwise use the current directory.

## Pre-flight Validation (mandatory -- run before spawning any agents)

Run these checks in order. If ANY check fails, stop immediately, report the specific error, and do NOT spawn agents.

| # | Check | How | Fail message |
|---|-------|-----|-------------|
| 0 | Clean stale working files | If `docs/.review_temp/` exists, delete it (legacy location). If `REVIEW_OUTPUT_DIR` exists, delete only working files (SHARED_CONTEXT.md, REVIEW_STANDARDS.md) -- preserve existing agent reports | (no fail -- just clean up) |
| 1 | `.keboola/` exists | `Glob: .keboola/manifest.json` | "No .keboola/ directory found. Run `/kbc-init` or `/kbc-pull` first." |
| 2 | Manifest readable | `Read: .keboola/manifest.json` | "Cannot read .keboola/manifest.json. File may be corrupted." |
| 3 | MCP reachable | Call `mcp__keboola__get_project_info` | "Keboola MCP not reachable. Check your storage API token and network." |
| 4 | Project has configs | Call `mcp__keboola__get_configs` and verify non-empty result | "Project has no configurations. Nothing to review." |

All checks passed? Proceed to output directory setup.

## Output Directory Setup

After pre-flight step 3, extract the project name from the `mcp__keboola__get_project_info` result.

1. **Sanitize project name**: lowercase, replace spaces with hyphens, strip all characters except `a-z`, `0-9`, `-`. Fallback chain: project name -> project ID -> `unknown-project`.
2. **Set `REVIEW_OUTPUT_DIR`**: `docs/output/review/<sanitized-name>/`
3. Create the directory: `mkdir -p REVIEW_OUTPUT_DIR`

Example: project "My Test Project (EU)" -> `docs/output/review/my-test-project-eu/`

## Scope Selection

Parse the user's arguments for optional flags:

### `--scope=agent1,agent2,...`

Run only the listed agents instead of the default set. Valid scope keywords:

| Keyword | Agent type | Default |
|---------|-----------|---------|
| sql | kbc-sql-reviewer | Yes |
| config | kbc-config-reviewer | Yes |
| dwh | kbc-dwh-architect | Yes |
| data-quality | kbc-data-quality-analyst | Yes |
| semantic | kbc-semantic-layer-reviewer | Yes |
| security | kbc-security-auditor | Yes |
| performance | kbc-performance-optimizer | Yes |
| financial | kbc-financial-analyst | FI |
| template | kbc-template-readiness | FI |
| fi-spec | kbc-fi-template-spec | FI |

Example: `/kbc-review --scope=sql,security` runs only sql-reviewer and security-auditor.

If `--scope` is not provided, run all 7 general agents (default). Add `--fi` to include financial-analyst, template-readiness, and fi-template-spec (10 total).

Note: If `--scope` explicitly includes `financial` or `template`, the `--fi` flag is auto-enabled.
You do NOT need to pass both `--scope=financial` and `--fi` -- either one works.

#### Scope presets

| Preset | Expands to | Use case |
|--------|-----------|----------|
| `quick-check` | sql, config | Fast syntax + config validation |
| `architecture` | dwh, semantic, performance | Data model and pipeline design |
| `compliance` | security, data-quality | Security audit + data integrity |

Example: `/kbc-review --scope=architecture`

### `--quick`

Skip the consolidator agent entirely. When all selected reviewers finish, read their reports directly from `REVIEW_OUTPUT_DIR` and present an inline summary to the user (severity counts + top findings from each report). Do NOT write `PROJECT_REVIEW_REPORT.md`.

Quick mode is automatic when `--scope` selects 1-2 agents.

### `--consolidate-only`

Skip reviewer agents. Read existing reports from `REVIEW_OUTPUT_DIR` and run only the consolidator. Use this to retry consolidation after a previous failed run.

### `--fi`

Include Financial Intelligence agents (financial-analyst, template-readiness, fi-template-spec) alongside general review agents. Without this flag, only the 7 general-purpose agents run.

Equivalent to adding `--scope=financial,template,fi-spec` to the default set.

### Combined behavior

| Agents selected | Consolidator | Output |
|----------------|-------------|--------|
| All 7 (default) | Yes | `REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md` |
| All 10 (--fi) | Yes | `REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md` |
| 3+ with --scope | Yes | `REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md` |
| 1-2 with --scope | No (auto-quick) | Inline summary, agent reports preserved |
| Any + --quick | No | Inline summary, agent reports preserved |
| --consolidate-only | Yes (only) | `REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md` |

## Team Structure

Create a team called `kbc-review` with the following agents and tasks:

### General Review Agents (always run, in parallel)

All agents write concise findings to `REVIEW_OUTPUT_DIR` (preserved after consolidation).

| Agent | Type | Task | Output |
|-------|------|------|--------|
| sql-reviewer | kbc-sql-reviewer | Review all SQL transformations for quality, anti-patterns, and correctness | `REVIEW_OUTPUT_DIR/sql-reviewer.md` |
| config-reviewer | kbc-config-reviewer | Review all component configurations for best practices and issues | `REVIEW_OUTPUT_DIR/config-reviewer.md` |
| dwh-architect | kbc-dwh-architect | Assess data model architecture, naming, layering, and structure | `REVIEW_OUTPUT_DIR/dwh-architect.md` |
| data-quality | kbc-data-quality-analyst | Analyze data quality: NULLs, duplicates, stale data, referential integrity | `REVIEW_OUTPUT_DIR/data-quality.md` |
| semantic-reviewer | kbc-semantic-layer-reviewer | Review semantic layer: metric definitions, completeness, generation readiness | `REVIEW_OUTPUT_DIR/semantic-reviewer.md` |
| security-auditor | kbc-security-auditor | Audit security: credentials, PII, access control, compliance | `REVIEW_OUTPUT_DIR/security-auditor.md` |
| performance-optimizer | kbc-performance-optimizer | Analyze performance: job durations, SQL efficiency, incremental loading, parallelization | `REVIEW_OUTPUT_DIR/performance-optimizer.md` |

### Financial Intelligence Agents (only with `--fi` or `--scope=financial,template`)

| Agent | Type | Task | Output |
|-------|------|------|--------|
| financial-analyst | kbc-financial-analyst | Validate financial logic: P&L, Balance Sheet, KPIs, budget comparisons | `REVIEW_OUTPUT_DIR/financial-analyst.md` |
| template-readiness | kbc-template-readiness | Assess template readiness: parameterization, mapping tables, generation blockers | `REVIEW_OUTPUT_DIR/template-readiness.md` |
| fi-template-spec | kbc-fi-template-spec | Template specification: delta analysis, ER diagram, source KB, template gaps | `REVIEW_OUTPUT_DIR/fi-template-spec.md` |

### Consolidator (runs after all reviewers finish)

| Agent | Type | Task | Final Output |
|-------|------|------|--------------|
| consolidator | kbc-review-consolidator | Map data flow (inline), consolidate all reports, clean up working files | `REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md` |

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
- `prompt`: "Pre-scan this Keboola project. Write a concise project overview to REVIEW_OUTPUT_DIR/PROJECT_OVERVIEW.md including: component inventory (type, name, count), data flow summary (sources -> transformations -> destinations), bucket structure with table counts. Keep under 100 lines. Mark task completed when done."
  (Replace `REVIEW_OUTPUT_DIR` with the actual path)
- `model`: "sonnet"
- **Timeout: 90 seconds.** If it times out, proceed without the overview -- reviewers will fetch their own context.

Wait for pre-scanner to complete before spawning review agents.

### 2. Create output directory and all tasks

First, create the output directory and shared context file:
```bash
mkdir -p REVIEW_OUTPUT_DIR
```

Then create the shared context file for cross-agent findings:

Write `REVIEW_OUTPUT_DIR/SHARED_CONTEXT.md`:
```markdown
# Shared Context (cross-agent findings)

Agents: append cross-domain findings relevant to OTHER agents here.

| Agent | Finding | Relevant-to |
|-------|---------|-------------|
```

Then copy the review standards reference file to the output directory:
```bash
cp ${PLUGIN_DIR}/standards/review-standards.md REVIEW_OUTPUT_DIR/REVIEW_STANDARDS.md
```
If the file doesn't exist at the plugin path, use the Glob tool to find `review-standards.md` and copy it.

Then create tasks using TaskCreate:

**Task 1-7: General reviews** (no dependencies, always created)
- Subject: "[Agent name] review"
- Description: "Run the [agent type] agent to review the project and write concise report to REVIEW_OUTPUT_DIR/[agent-name].md"
- These 7 tasks have NO dependencies and can run in parallel

**Task 8-10: FI reviews** (no dependencies, only if `--fi` is set or `--scope` includes them)
- Subject: "[Agent name] review"
- Description: "Run the [agent type] agent to review the project and write concise report to REVIEW_OUTPUT_DIR/[agent-name].md"

**Task N+1: Consolidation** (blocked by all review tasks)
- Subject: "Consolidate all review reports"
- Description: "Map data flow (inline), merge all reports into REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md, then clean up working files"
- Set `addBlockedBy` to all review task IDs

### 3. Spawn review agents in parallel

If `--scope` includes `financial` or `template`, treat as if `--fi` is set.

Spawn 7 general agents (or 10 if `--fi` is set, or the subset specified by `--scope`).

Use the Task tool to spawn each review agent with:
- `subagent_type`: the agent type from the table above (e.g., "kbc-sql-reviewer")
- `team_name`: "kbc-review"
- `name`: the agent name from the table above (e.g., "sql-reviewer")
- `prompt`: "You are part of the kbc-review team. Your output directory is REVIEW_OUTPUT_DIR. If REVIEW_OUTPUT_DIR/PROJECT_OVERVIEW.md exists, read it first for project context. Read REVIEW_OUTPUT_DIR/REVIEW_STANDARDS.md for Actum naming conventions and Keboola best practices -- validate against sections relevant to your domain. Complete your assigned review task using Keboola MCP tools and local files. Write your concise findings report to REVIEW_OUTPUT_DIR/[your-agent-name].md (compact table format, under 200 lines). After writing your report, read REVIEW_OUTPUT_DIR/SHARED_CONTEXT.md and append any cross-domain findings relevant to OTHER agents. Mark your task as completed."
  (Replace all `REVIEW_OUTPUT_DIR` with the actual path)
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

1. **Backup previous consolidated report** (if exists):
   ```bash
   if [ -f REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md ]; then
     cp REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md "REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.$(date +%Y%m%d_%H%M%S).md"
   fi
   ```
2. Spawn the consolidator:
   - `subagent_type`: "kbc-review-consolidator"
   - `team_name`: "kbc-review"
   - `name`: "consolidator"
   - `prompt`: "You are the consolidator for the kbc-review team. The review output directory is REVIEW_OUTPUT_DIR. [List which agents completed and which timed out/failed]. Start Phase 1 (data flow mapping -- hold in memory). Phase 2: use Glob to find all *.md reports in REVIEW_OUTPUT_DIR, read all available agent reports AND REVIEW_OUTPUT_DIR/SHARED_CONTEXT.md for cross-agent findings. Phase 3: write single REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md, enriching merged findings with shared context. List any missing reviews in the report. Phase 4: delete ONLY working files (SHARED_CONTEXT.md, REVIEW_STANDARDS.md) from REVIEW_OUTPUT_DIR -- preserve all agent reports and PROJECT_OVERVIEW.md. Mark task completed."
     (Replace all `REVIEW_OUTPUT_DIR` with the actual path)
3. **Consolidator timeout: 8 minutes.** If consolidator times out:
   - Preserve `REVIEW_OUTPUT_DIR` (do NOT delete anything)
   - Tell user: "Consolidator timed out. Individual reports preserved in REVIEW_OUTPUT_DIR. Retry with `/kbc-review --consolidate-only`."

### 6. Report completion

**Full mode** (consolidator ran):
1. Read `REVIEW_OUTPUT_DIR/PROJECT_REVIEW_REPORT.md`
2. Present summary: total issues by severity, top 5 critical findings, health assessment, link to report
3. Note any agents that timed out or failed

**Quick mode** (no consolidator):
1. Read each agent report from `REVIEW_OUTPUT_DIR`
2. Present inline summary: severity counts per agent, top findings from each
3. Note: "Individual reports preserved in REVIEW_OUTPUT_DIR. Run `/kbc-review --consolidate-only` for full consolidated report."

### 7. Clean up

After presenting results:
1. Send shutdown requests to all teammates
2. Call TeamDelete to clean up the team
3. Agent reports, PROJECT_OVERVIEW.md, and PROJECT_REVIEW_REPORT.md are permanently preserved in `REVIEW_OUTPUT_DIR`
4. Working files (SHARED_CONTEXT.md, REVIEW_STANDARDS.md) are cleaned by the consolidator in full mode, or left for user inspection in quick mode

## Error Handling

- **Agent timeout**: mark timed-out, proceed with available reports (see step 4)
- **Consolidator timeout**: preserve output dir, suggest `--consolidate-only` retry
- **MCP unreachable**: caught by pre-flight (step 0)
- **No .keboola dir**: caught by pre-flight (step 0)
- **Partial results**: consolidator lists missing reviews in report, proceeds with what's available
