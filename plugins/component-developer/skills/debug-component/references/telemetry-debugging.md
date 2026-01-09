# Telemetry Data Debugging Guide

Complete guide for querying Keboola telemetry data to debug component configurations, jobs, and issues across all stacks.

## Overview

The Keboola Telemetry Project (ID: 133) aggregates operational and usage telemetry from all Keboola stacks. It provides read-only access to raw telemetry data for analysis, debugging, and support ticket investigation.

**Project Details:**
- **ID:** 133
- **Name:** L3 [Data Product] Telemetry Data Discovery
- **Stack:** us-east4.gcp.keboola.com
- **SQL Dialect:** Snowflake
- **MCP Server:** `keboola-mcp-us-east4gcp`

## Connecting to Telemetry

### MCP Server Connection

1. Use the MCP server `keboola-mcp-us-east4gcp`
2. Call `get_project_info` to verify connection to project 133
3. Use `query_data` tool to execute SQL queries

### Verifying Connection

```
get_project_info with parameters: {}
```

Expected response should show:
- `project_id: 133`
- `project_name: "L3 [Data Product] Telemetry Data Discovery"`
- `sql_dialect: "Snowflake"`

## Key Telemetry Tables

All telemetry tables are in the bucket `in.c-out_kbc_public_telemetry` with fully qualified names using database `KBC_USE4_37` and schema `out.c-kbc_public_telemetry`.

### Configuration Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kbc_component_configuration` | Root component configurations | `configuration_json`, `kbc_component_id`, `configuration_id_num` |
| `kbc_component_configuration_row` | Configuration rows (for row-based components) | `configuration_row_json`, `configuration_row_id_num` |
| `kbc_component_configuration_version` | Configuration version history | `configuration_version`, `kbc_branch_id` |

### Job Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kbc_job` | Job execution records | `kbc_job_id`, `kbc_component_id`, `job_status` |
| `kbc_job_input_table` | Job input table mappings | `kbc_job_id`, `kbc_project_table_id` |
| `kbc_job_output_table` | Job output table mappings | `kbc_job_id`, `kbc_project_table_id` |

### Storage Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kbc_bucket` | Bucket metadata | `kbc_project_bucket_id` |
| `kbc_table` | Table metadata | `kbc_project_table_id` |
| `kbc_column` | Column metadata | `kbc_project_column_id` |

## Important Column Mappings

The telemetry tables use different column names than what you might expect. Here are the key mappings:

### Configuration Row Table (`kbc_component_configuration_row`)

| Expected Column | Actual Column | Notes |
|-----------------|---------------|-------|
| `component_id` | `kbc_component_id` | Includes stack suffix (e.g., `keboola.app-data-gateway_com-keboola-gcp-europe-west3`) |
| `configuration_id` | `kbc_component_configuration_id` | Composite key with stack |
| `configuration_row_id` | `configuration_row_id_num` | The row ID you're looking for |
| `stack` | `dst_stack_single` | Connection URL format (see Stack Mappings below) |
| `configuration_json` | `configuration_row_json` | The actual configuration JSON |

### Configuration Table (`kbc_component_configuration`)

| Expected Column | Actual Column | Notes |
|-----------------|---------------|-------|
| `component_id` | `kbc_component_id` | Component identifier |
| `configuration_id` | `configuration_id_num` | Configuration ID |
| `configuration_json` | `configuration_json` | Root configuration JSON |
| `stack` | `dst_stack_single` | Connection URL format |

## Stack Name Mappings

The `dst_stack_single` column uses connection URL format, not the internal stack name:

| Internal Stack Name | dst_stack_single Value |
|---------------------|------------------------|
| `com-keboola-gcp-europe-west3` | `connection.europe-west3.gcp.keboola.com` |
| `com-keboola-gcp-us-east4` | `connection.us-east4.gcp.keboola.com` |
| `com-keboola-azure-north-europe` | `connection.north-europe.azure.keboola.com` |
| `kbc-eu-central-1` | `connection.eu-central-1.keboola.com` |
| `kbc-us-east-1` | `connection.keboola.com` |

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

From project info, these are the database names for each stack:

| Stack | Database |
|-------|----------|
| COATES | KBC_USE4_33 |
| CREDITINFO | KBC_USE4_33 |
| cloud-keboola-cs | KBC_USE4_35 |
| GRPN | KBC_USE4_20 |
| HCI | KBC_USE4_21 |
| HCKZ | KBC_USE4_286 |
| INNOGY | KBC_USE4_22 |
| PASHA | KBC_USE4_377 |
| RBI | KBC_USE4_69 |
| cloud-keboola-slsp | KBC_USE4_23 |
| com-keboola-azure-north-europe | KBC_USE4_54 |
| com-keboola-gcp-europe-west3 | KBC_USE4_26 |
| com-keboola-gcp-us-east4 | KBC_USE4_27 |
| kbc-eu-central-1 | KBC_USE4_30 |
| AWS US | KBC_USE4_32 |

## Related Guides

- [Debugging Guide](debugging.md) - General component debugging with MCP and Datadog
- [Architecture Guide](architecture.md) - Component structure and error handling
