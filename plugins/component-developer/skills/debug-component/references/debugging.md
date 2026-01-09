# Component Debugging Guide

Complete guide for debugging Keboola components using available tools and services.

## Overview

When components fail or behave unexpectedly, use these debugging approaches:
1. **Keboola MCP Server** - Query jobs, configurations, and output data
2. **Datadog** - Search and analyze component logs
3. **Local Testing** - Run components locally for rapid iteration

## Keboola MCP Server Debugging

The Keboola MCP server provides tools for inspecting jobs, configurations, and data directly.

### Available Tools

| Tool | Purpose |
|------|---------|
| `list_jobs` | Find jobs by component, config, or status |
| `get_job` | Get detailed information about a specific job |
| `run_job` | Execute a job for testing |
| `get_config` | Inspect component configuration |
| `query_data` | Query output tables to verify results |

### Finding Failed Jobs

Use `list_jobs` to find jobs that have failed:

```
list_jobs with parameters:
- status: "error"
- component_id: "vendor.component-name"
- limit: 10
```

Parameters:
- `status` - Filter by job status: "error", "success", "processing", "waiting", "terminating", "terminated", "cancelled"
- `component_id` - Filter by specific component ID
- `config_id` - Filter by specific configuration ID
- `limit` - Number of jobs to return (default 100, max 500)
- `offset` - Pagination offset
- `sort_by` - Sort field (default "startTime")
- `sort_order` - Sort direction: "asc" or "desc" (default "desc")

### Inspecting Job Details

Once you have a job ID, get detailed information:

```
get_job with parameters:
- job_id: "123456789"
```

Returns:
- Job status and duration
- Input/output parameters
- Error messages and stack traces
- Resource usage metrics

### Checking Configuration

Verify the component configuration is correct:

```
get_config with parameters:
- component_id: "vendor.component-name"
- configuration_id: "config-id"
```

This helps identify:
- Missing or incorrect parameters
- Invalid credentials
- Misconfigured input/output mappings

### Re-running Jobs

After fixing issues, test by running the job again:

```
run_job with parameters:
- component_id: "vendor.component-name"
- configuration_id: "config-id"
```

### Verifying Output Data

Query output tables to verify the component produced correct results:

```
query_data with parameters:
- sql_query: "SELECT * FROM \"DATABASE\".\"SCHEMA\".\"TABLE\" LIMIT 10"
- query_name: "Verify component output"
```

SQL dialect notes:
- Snowflake: Use double quotes for identifiers `"column_name"`
- BigQuery: Use backticks for identifiers `` `column_name` ``
- Always use fully qualified table names

### Debugging Workflow

Follow this systematic approach:

1. **Find the failing job**
   ```
   list_jobs with status="error" and component_id="your-component"
   ```

2. **Get job details**
   ```
   get_job with job_id from step 1
   ```
   - Look at error messages
   - Check input parameters
   - Note any timeout or resource issues

3. **Verify configuration**
   ```
   get_config to check configuration is correct
   ```
   - Ensure all required parameters are set
   - Verify credentials are valid
   - Check input/output mappings

4. **Fix the issue**
   - Update component code
   - Push changes
   - Wait for deployment (up to 5 minutes)

5. **Re-run and verify**
   ```
   run_job to test the fix
   get_job to check new job status
   query_data to verify output
   ```

### Common Issues and Solutions

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| Exit code 1 | User/configuration error | Check parameters, credentials, input data |
| Exit code 2 | System/application error | Check logs for stack trace, fix code bug |
| Missing output | No manifest written | Ensure `write_manifest()` is called |
| Wrong data | Logic error | Query output tables, debug transformation logic |
| Timeout | Long running operation | Optimize code or increase timeout setting |
| Memory error | Large data processing | Use generators, process in chunks |

## Datadog Debugging

Datadog provides centralized logging for all Keboola components across all environments. Use it to search logs across component runs, filter by component ID, job ID, or project, and analyze error patterns and trends.

### Keboola Log Tags

Keboola logs use these primary tags for filtering:

| Tag | Description | Example |
|-----|-------------|---------|
| `componentid` | Component identifier | `componentid:keboola.python-transformation-v2` |
| `configid` | Configuration ID | `configid:65904349` |
| `projectid` | Keboola project ID | `projectid:14370` |
| `pod_name` | Job pod name (contains job ID) | `pod_name:job-150303519` |
| `env` | Keboola stack/environment | `env:com-keboola-azure-north-europe` |
| `service` | Service name | `service:job-queue-runner` |
| `status` | Log level | `status:error`, `status:info` |

The `@component` attribute in log messages also contains the component ID and can be used for filtering.

### Common Environments (env tag)

| Environment | Description |
|-------------|-------------|
| `kbc-us-east-1` | AWS US East (connection.keboola.com) |
| `com-keboola-azure-north-europe` | Azure North Europe |
| `cloud-<customer>-<region>` | GCP dedicated stack (single tenant) |

### Log Search Queries

Filter logs using Datadog query syntax. Tags use the format `tag:value`, while attributes use `@attribute:value`.

**Find all logs for a component:**
```
componentid:keboola.python-transformation-v2
```

**Find error logs for a component:**
```
componentid:keboola.ex-db-mssql status:error
```

**Find logs for a specific job (by pod name):**
```
pod_name:job-150303519
```

**Find logs for a specific project:**
```
projectid:14370
```

**Combine multiple filters:**
```
componentid:keboola.python-transformation-v2 projectid:6625 status:error
```

**Filter by environment:**
```
componentid:keboola.ex-db-mssql env:kbc-us-east-1
```

**Use wildcards for component families:**
```
componentid:keboola.ex-*
```

### Datadog API Access

For programmatic access, Datadog requires two authentication headers:

| Header | Purpose |
|--------|---------|
| `DD-API-KEY` | Identifies the organization |
| `DD-APPLICATION-KEY` | Identifies the user/application with specific permissions |

**API Endpoints by Region:**

| Region | API Endpoint | Web UI |
|--------|--------------|--------|
| EU | `https://api.datadoghq.eu` | `https://app.datadoghq.eu` |
| US1 | `https://api.datadoghq.com` | `https://app.datadoghq.com` |

Keboola uses the EU region (`api.datadoghq.eu`).

### Curl Examples

**Search logs for a component (last hour):**
```bash
curl -s -X POST "https://api.datadoghq.eu/api/v2/logs/events/search" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d '{
    "filter": {
      "query": "componentid:keboola.python-transformation-v2",
      "from": "now-1h",
      "to": "now"
    },
    "page": {
      "limit": 10
    }
  }'
```

**Search error logs for a specific project:**
```bash
curl -s -X POST "https://api.datadoghq.eu/api/v2/logs/events/search" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d '{
    "filter": {
      "query": "projectid:14370 status:error",
      "from": "now-24h",
      "to": "now"
    },
    "page": {
      "limit": 50
    }
  }'
```

**Search logs for a specific job:**
```bash
curl -s -X POST "https://api.datadoghq.eu/api/v2/logs/events/search" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d '{
    "filter": {
      "query": "pod_name:job-150303519",
      "from": "now-24h",
      "to": "now"
    },
    "page": {
      "limit": 100
    }
  }'
```

### API Response Structure

The Logs API returns a JSON response with this structure:

```json
{
  "data": [
    {
      "id": "log-id",
      "type": "log",
      "attributes": {
        "service": "job-queue-runner",
        "host": "hostname",
        "message": "Log message content",
        "status": "info",
        "timestamp": "2025-01-15T10:43:09.353Z",
        "tags": ["componentid:keboola.python-transformation-v2", "projectid:6625", ...],
        "attributes": {
          "component": "keboola.python-transformation-v2",
          "runId": "1280579774",
          "level_name": "INFO"
        }
      }
    }
  ],
  "meta": {
    "page": { "after": "cursor-for-pagination" }
  }
}
```

### Debugging Workflow with Datadog

1. **Get the job ID** from Keboola UI or MCP server (`list_jobs` or `get_job`)

2. **Search logs by job** using the pod_name tag:
   ```
   pod_name:job-<job-id>
   ```

3. **Filter for errors** if needed:
   ```
   pod_name:job-<job-id> status:error
   ```

4. **Analyze the timeline** - logs are timestamped, so you can trace the execution flow

5. **Check for patterns** across multiple jobs:
   ```
   componentid:<component-id> status:error
   ```

## Local Testing

For rapid iteration, test components locally before deployment.

### Basic Local Run

Always sync dependencies before running the component locally:

```bash
# Sync dependencies first
uv sync

# Run component with data directory (one-liner)
KBC_DATADIR=data uv run src/component.py
```

This approach ensures dependencies are up-to-date and uses the project's virtual environment correctly. The one-liner format with inline environment variable is preferred as it works regardless of shell session persistence.

### With Docker

```bash
# Build image
docker build -t my-component .

# Run with data directory mounted
docker run -v $(pwd)/data:/data my-component
```

### Creating Test Data

Set up the `data/` directory structure:

```
data/
├── config.json          # Component configuration
├── in/
│   ├── tables/          # Input CSV files
│   └── files/           # Input files
└── out/
    ├── tables/          # Output will appear here
    └── files/           # Output files will appear here
```

Example `data/config.json`:
```json
{
  "parameters": {
    "api_key": "test-key",
    "endpoint": "https://api.example.com"
  }
}
```

### Debugging Tips

1. **Add logging**: Use `logging.debug()` for detailed output during development
2. **Check exit codes**: Exit 1 = user error, Exit 2 = system error
3. **Inspect manifests**: Verify output table manifests are created correctly
4. **Test incrementally**: Test each component method separately

## Related Guides

- [Telemetry Debugging Guide](telemetry-debugging.md) - Query telemetry data for support ticket investigation
- [Architecture Guide](architecture.md) - Component structure and error handling
- [Code Quality Guide](code-quality.md) - Logging and debugging best practices
- [Developer Portal Guide](developer-portal.md) - Registration and deployment
