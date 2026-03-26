# Telemetry Analysis Reference

Guide for querying Keboola telemetry data to assess the real-world impact of component changes during backward compatibility review.

> **CRITICAL: Repositories are PUBLIC. NEVER write any client name, project name, stack URL, organization name, company name, or any identifying information into PR comments or any file. Report ONLY anonymized aggregate numbers (counts, percentages, error rates).**

## Overview

The Keboola Telemetry Project (ID: 133) aggregates operational and usage telemetry from all Keboola stacks. It provides read-only access to raw telemetry data for analysis.

**Connection Details:**
- **Project ID:** 133
- **Name:** L3 [Data Product] Telemetry Data Discovery
- **Stack:** us-east4.gcp.keboola.com
- **SQL Dialect:** Snowflake
- **MCP Server:** `keboola-mcp-us-east4gcp`

## Connecting to Telemetry

1. Use the MCP server `keboola-mcp-us-east4gcp`
2. Call `get_project_info` to verify connection to project 133
3. Use `query_data` tool to execute SQL queries

If switching from another project: `mcp-cli auth logout keboola-mcp-us-east4gcp` first, then re-authenticate selecting project 133.

## Internal Projects to Exclude

These are Keboola-internal testing projects — always exclude from "real user" impact counts:

| Project ID | Stack | Notes |
|-----------|-------|-------|
| 4214 | us-east4.gcp | Internal testing |

This list will be expanded over time. Always state in your review comment: "Excluding N known internal/test projects."

## Key Tables

All telemetry tables use database `KBC_USE4_37` and schema `out.c-kbc_public_telemetry`.

| Table | Purpose |
|-------|---------|
| `kbc_component_configuration` | Root component configurations with `configuration_json` |
| `kbc_component_configuration_row` | Configuration rows with `configuration_row_json` |
| `kbc_job` | Job execution records |
| `kbc_project` | Project metadata |

## Telemetry Queries

### Query 1: Active Configuration Count

Determine how many real (non-internal) configurations exist for this component:

```sql
SELECT
  COUNT(*) as total_configs,
  COUNT(CASE WHEN "kbc_configuration_is_deleted" = 'false' THEN 1 END) as active_configs
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration"
WHERE "kbc_component_id" LIKE '<COMPONENT_ID>%'
  AND "kbc_project_id" NOT IN ('4214')
```

**Why LIKE with `%`:** Component IDs in telemetry may have stack suffixes (e.g., `keboola.ex-db-mysql_com-keboola-gcp-europe-west3`). Using LIKE ensures we catch all stacks.

**Interpretation:**
- 0 active configs = low risk (no real users affected)
- 1-10 active configs = moderate audience
- 10+ active configs = high audience, extra caution needed

### Query 2: Job Statistics (Last 30 Days)

Check recent activity and error rates:

```sql
SELECT
  COUNT(*) as total_jobs,
  COUNT(DISTINCT "kbc_component_configuration_id") as configs_with_jobs,
  SUM(CASE WHEN "job_status" = 'error' THEN 1 ELSE 0 END) as error_count,
  ROUND(
    SUM(CASE WHEN "job_status" = 'error' THEN 1 ELSE 0 END) * 100.0
    / NULLIF(COUNT(*), 0), 1
  ) as error_rate_pct
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_job"
WHERE "kbc_component_id" LIKE '<COMPONENT_ID>%'
  AND "job_start_at" >= TO_VARCHAR(DATEADD('day', -30, CURRENT_TIMESTAMP()), 'YYYY-MM-DD"T"HH24:MI:SS')
```

**Interpretation:**
- High job count = actively used, changes have high impact
- High error rate = component already has issues, PR might help or worsen
- 0 jobs in 30 days = component may be dormant

### Query 3: Configuration Parameter Usage

When a property is being removed, renamed, or its type changed, check how many configs actually use it:

```sql
SELECT "configuration_json"
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration"
WHERE "kbc_component_id" LIKE '<COMPONENT_ID>%'
  AND "kbc_configuration_is_deleted" = 'false'
  AND "kbc_project_id" NOT IN ('4214')
LIMIT 50
```

After retrieving the JSON, parse it to count:
- How many configs set the property being changed
- What values are used (for enum narrowing)
- Whether the property has the default value or custom values

**Example analysis:**
```
Retrieved 42 active configurations.
- 38 configs set "api_version" field
  - 35 use "v2" (being kept)
  - 3 use "v1" (being removed from enum)
→ HIGH RISK: 3 configs will break if "v1" is removed
```

### Query 4: Configuration Row Parameter Usage

For row-based components, check row configurations:

```sql
SELECT "configuration_row_json"
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration_row"
WHERE "kbc_component_id" LIKE '<COMPONENT_ID>%'
  AND "kbc_configuration_row_is_deleted" = 'false'
LIMIT 50
```

### Query 5: Component Usage Across Stacks

Check which stacks actively use this component:

```sql
SELECT
  "dst_stack_single",
  COUNT(*) as config_count,
  COUNT(CASE WHEN "kbc_configuration_is_deleted" = 'false' THEN 1 END) as active_count
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration"
WHERE "kbc_component_id" LIKE '<COMPONENT_ID>%'
  AND "kbc_project_id" NOT IN ('4214')
GROUP BY "dst_stack_single"
ORDER BY active_count DESC
```

**Important:** Do NOT include the stack names in the PR comment. Only report the total count: "Active across N stacks."

## Datadog Error Patterns (Optional)

If Datadog MCP is available, check recent error patterns:

```
search_datadog_logs:
  query: "componentid:<COMPONENT_ID> status:error"
  from: "now-7d"
  to: "now"
```

This reveals:
- Current error patterns that the PR might fix or worsen
- Common failure modes
- Whether the component is stable or already problematic

## Telemetry Analysis Workflow

1. **Connect** to MCP server `keboola-mcp-us-east4gcp` and verify project 133
2. **Run Query 1** (active configs) for each component ID
3. **Run Query 2** (job stats) for each component ID
4. **If breaking changes detected in diff**, run Query 3/4 to check parameter usage
5. **Optionally** check Datadog for error patterns
6. **Compile** anonymized telemetry summary for the review comment
7. **Cross-reference** telemetry results with diff findings to determine final severity

## Anonymization Rules

When writing the review comment:

| OK to include | NEVER include |
|--------------|---------------|
| Total count of configurations | Project IDs |
| Number of configs using a parameter | Project names |
| Job count and error rate percentage | Stack URLs or names |
| Number of stacks used | Organization names |
| "N configs use value X" | Company names |
| "Excluding N internal projects" | Client names |
| Aggregate statistics | Configuration IDs |

**Template for telemetry section in review comment:**

```markdown
### Telemetry Summary
| Metric | Value |
|--------|-------|
| Active configurations (non-internal) | 42 |
| Configurations with jobs (last 30d) | 38 |
| Jobs in last 30 days | 1,247 |
| Error rate | 2.3% |
| Active across stacks | 4 |

*Excluding 1 known internal/test project from counts.*
*Telemetry data is anonymized. No client or project identifiers are disclosed.*
```

## When Telemetry Is Unavailable

If MCP access to project 133 is not available:

1. **Explicitly state** in the review: "Telemetry data unavailable — review based on code analysis only."
2. **Assume worst case** for severity — treat changes as if configs exist
3. **Still perform** full code-based analysis (Steps 1-3 of the main procedure)
4. **Recommend** that someone with telemetry access verify before merging
