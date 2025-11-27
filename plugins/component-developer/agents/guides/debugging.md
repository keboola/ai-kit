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

<!-- TODO: This section will be expanded with specific Datadog configuration -->

Datadog provides centralized logging for Keboola components. Use it to:
- Search logs across all component runs
- Filter by component ID, job ID, or project
- Analyze error patterns and trends

### Log Search Basics

Filter logs using tags:
- `@component:<component-id>` - Filter by component (e.g., `@component:keboola.python-transformation-v2`)
- Additional tags for job ID, project ID, and environment may be available

### Common Queries

Example queries for debugging:
- All errors for a component: `@component:keboola.ex-my-api status:error`
- Logs for specific job: `@job_id:<job-id>`
- Recent failures: `@component:keboola.ex-my-api status:error` with time range "last 1 hour"

### Datadog API Access

For programmatic access, Datadog requires:
- API Key (identifies organization)
- Application Key (identifies user/application with specific permissions)

Both keys are passed as HTTP headers:
- `DD-API-KEY: <api-key>`
- `DD-APPLICATION-KEY: <application-key>`

API endpoint varies by region:
- US1: `https://api.datadoghq.com`
- EU: `https://api.datadoghq.eu`

## Local Testing

For rapid iteration, test components locally before deployment.

### Basic Local Run

```bash
# Set data directory
export KBC_DATADIR=./data

# Run component
python src/component.py
```

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

- [Architecture Guide](architecture.md) - Component structure and error handling
- [Code Quality Guide](code-quality.md) - Logging and debugging best practices
- [Developer Portal Guide](developer-portal.md) - Registration and deployment
