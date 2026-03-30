# Telemetry Data Debugging Guide

Complete guide for querying Keboola telemetry data to debug component configurations, jobs, and issues across all stacks.

## Overview

The Keboola Telemetry Project (ID: 133) aggregates operational and usage telemetry from all Keboola stacks. It provides read-only access to raw telemetry data for analysis, debugging, and support ticket investigation.

For connection details, key tables, column mappings, stack name mappings, and anonymization rules — see [keboola-context: telemetry](../../keboola-context/references/telemetry.md).

## Example Queries

### Find Configuration Row JSON by Row ID

The most reliable way to find a configuration row is by its `configuration_row_id_num`:

```sql
SELECT "configuration_row_json" 
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration_row" 
WHERE "configuration_row_id_num" = '01katngamqm5qsa55hn4gwbdb8' 
LIMIT 1;
```

### Find Configuration Row with All Details

```sql
SELECT 
    "kbc_component_id", 
    "kbc_component_configuration_id", 
    "configuration_row_id_num", 
    "dst_stack_single", 
    "kbc_configuration_row_is_deleted",
    "configuration_row_json"
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration_row" 
WHERE "configuration_row_id_num" = '01katngamqm5qsa55hn4gwbdb8' 
LIMIT 10;
```

### Find Root Configuration JSON

```sql
SELECT "configuration_json"
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration"
WHERE "kbc_component_id" LIKE 'keboola.app-data-gateway%'
AND "configuration_id_num" = '01kakd3q09dawzewwqc807et2t'
LIMIT 1;
```

### Find All Configurations for a Component on a Stack

```sql
SELECT 
    "configuration_id_num",
    "kbc_component_configuration",
    "dst_stack_single",
    "kbc_configuration_is_deleted"
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration"
WHERE "kbc_component_id" LIKE 'keboola.ex-db-mysql%'
AND "dst_stack_single" = 'connection.europe-west3.gcp.keboola.com'
AND "kbc_configuration_is_deleted" = 'false'
LIMIT 50;
```

### Find Jobs for a Configuration

```sql
SELECT 
    "kbc_job_id",
    "job_start_time",
    "job_end_time",
    "job_status",
    "job_error_message"
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_job"
WHERE "kbc_component_id" LIKE 'keboola.app-data-gateway%'
AND "configuration_id" = '01kakd3q09dawzewwqc807et2t'
ORDER BY "job_start_time" DESC
LIMIT 20;
```

## Debugging Workflow for Support Tickets

When investigating a support ticket with a failing job:

### 1. Gather Information from Ticket

Extract from the ticket:
- **Job ID** (e.g., `45267290`)
- **Stack** (e.g., `com-keboola-gcp-europe-west3`)
- **Component ID** (e.g., `keboola.app-data-gateway`)
- **Configuration ID** (e.g., `01kakd3q09dawzewwqc807et2t`)
- **Row ID** (if applicable, e.g., `01katngamqm5qsa55hn4gwbdb8`)
- **Error message**

### 2. Connect to Telemetry MCP Server

```
Use MCP server: keboola-mcp-us-east4gcp
Call: get_project_info
```

### 3. Query Configuration

For row-based configurations, search by `configuration_row_id_num`:

```sql
SELECT "configuration_row_json" 
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration_row" 
WHERE "configuration_row_id_num" = '<row_id>' 
LIMIT 1;
```

For root configurations:

```sql
SELECT "configuration_json"
FROM "KBC_USE4_37"."out.c-kbc_public_telemetry"."kbc_component_configuration"
WHERE "configuration_id_num" = '<config_id>'
LIMIT 1;
```

### 4. Analyze Configuration JSON

Parse the returned JSON and look for:
- Invalid parameter values
- Incorrect data types (e.g., `"size": "38,0"` for a string type)
- Missing required fields
- Malformed mappings

### 5. Document Findings

Report:
- The problematic configuration field
- Why it's invalid
- Suggested fix

## Common Issues Found in Telemetry

| Issue | How to Identify | Example |
|-------|-----------------|---------|
| Invalid data type | `"type": "string"` with numeric `"size"` like `"38,0"` | Column configured as string but with NUMBER precision |
| Missing credentials | Empty or null `#password` fields | OAuth not completed |
| Wrong table mapping | `"source"` table doesn't exist | Typo in table ID |
| Deleted configuration | `kbc_configuration_is_deleted = 'true'` | Config was deleted but job still references it |

## Database Reference

### Stack to Database Mapping

The `get_project_info` tool returns the database name for the current project's stack.
Public stacks and their databases:

| Stack | Database |
|-------|----------|
| com-keboola-azure-north-europe | KBC_USE4_54 |
| com-keboola-gcp-europe-west3 | KBC_USE4_26 |
| com-keboola-gcp-us-east4 | KBC_USE4_27 |
| kbc-eu-central-1 | KBC_USE4_30 |
| kbc-us-east-1 (AWS US) | KBC_USE4_32 |

For private/dedicated stacks, the database name is returned by `get_project_info` — use that value directly rather than looking it up here.

## Related Guides

- [Debugging Guide](debugging.md) - General component debugging with MCP and Datadog
- [Architecture Guide](../../develop-component/references/architecture.md) - Component structure and error handling
