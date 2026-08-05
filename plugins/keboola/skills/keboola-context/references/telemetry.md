# Keboola Telemetry — Connection and Structure

Shared reference for querying Keboola telemetry data. Used by debug-component and
review skills for their respective workflows.

## Connection

- **Project ID:** 133
- **Name:** L3 [Data Product] Telemetry Data Discovery
- **Stack:** us-east4.gcp.keboola.com
- **SQL Dialect:** Snowflake
- **MCP Server:** `keboola-mcp-us-east4gcp`

Connect:
1. Use MCP server `keboola-mcp-us-east4gcp`
2. Call `get_project_info` — verify `project_id: 133`
3. Use `query_data` for SQL

If switching from another project: `mcp-cli auth logout keboola-mcp-us-east4gcp` first,
then re-authenticate selecting project 133.

## Key Tables

All tables use database `KBC_USE4_37` and schema `out.c-kbc_public_telemetry`.

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `kbc_component_configuration` | Root component configurations | `configuration_json`, `kbc_component_id`, `configuration_id_num` |
| `kbc_component_configuration_row` | Row-based component configurations | `configuration_row_json`, `configuration_row_id_num` |
| `kbc_component_configuration_version` | Configuration version history | `configuration_version`, `kbc_branch_id` |
| `kbc_job` | Job execution records | `kbc_job_id`, `kbc_component_id`, `job_status` |
| `kbc_project` | Project metadata | `kbc_project_id` |
| `kbc_bucket` | Bucket metadata | `kbc_project_bucket_id` |
| `kbc_table` | Table metadata | `kbc_project_table_id` |

## Column Mappings

The telemetry tables use different column names than you might expect.

### `kbc_component_configuration`

| Conceptual name | Actual column | Notes |
|-----------------|---------------|-------|
| component_id | `kbc_component_id` | May include stack suffix — use `LIKE 'keboola.ex-db-mysql%'` |
| configuration_id | `configuration_id_num` | |
| stack | `dst_stack_single` | Connection URL format (see below) |
| configuration JSON | `configuration_json` | |
| deleted flag | `kbc_configuration_is_deleted` | String `'true'`/`'false'` |

### `kbc_component_configuration_row`

| Conceptual name | Actual column | Notes |
|-----------------|---------------|-------|
| component_id | `kbc_component_id` | |
| configuration_id | `kbc_component_configuration_id` | |
| row_id | `configuration_row_id_num` | |
| stack | `dst_stack_single` | |
| row JSON | `configuration_row_json` | |
| deleted flag | `kbc_configuration_row_is_deleted` | String `'true'`/`'false'` |

## Stack Name Mappings

The `dst_stack_single` column uses connection URL format:

| Stack | dst_stack_single |
|-------|-----------------|
| com-keboola-azure-north-europe | `connection.north-europe.azure.keboola.com` |
| com-keboola-gcp-europe-west3 | `connection.europe-west3.gcp.keboola.com` |
| com-keboola-gcp-us-east4 | `connection.us-east4.gcp.keboola.com` |
| kbc-eu-central-1 | `connection.eu-central-1.keboola.com` |
| kbc-us-east-1 | `connection.keboola.com` |

For private/dedicated stacks, the database name is returned by `get_project_info` — use that value directly.

## Internal Projects to Exclude

Always exclude Keboola-internal testing projects from "real user" impact counts:

| Project ID | Stack | Notes |
|-----------|-------|-------|
| 4214 | us-east4.gcp | Internal testing |

State in review comments: "Excluding N known internal/test projects."

## Anonymization Rules

Telemetry repositories are **public**. Never write client names, project names, stack
URLs, or any identifying information into PR comments or files.

| OK to include | NEVER include |
|--------------|---------------|
| Total count of configurations | Project IDs |
| Number of configs using a parameter | Project names |
| Job count and error rate percentage | Stack URLs or names |
| Number of stacks used | Organization names |
| "N configs use value X" | Company names |
| "Excluding N internal projects" | Client names |
| Aggregate statistics | Configuration IDs |
