# L3 inter-service relationships for mcp-server
# Included inside keboolaPlatform block in model.dsl
# All service URLs derived at runtime from storage_api_url via hostname suffix substitution.
# Source: KeboolaClient.__init__ in src/keboola_mcp_server/clients/client.py
# Note: component IDs are mcp-server-api and mcp-server-agent (not mcp-server)
# to avoid clashing with the container ID mcp-server.

mcp-server-api   -> connection   "verifies tokens, reads Storage API data (buckets, tables, files, configurations, workspaces)"
mcp-server-api   -> queue        "creates and monitors component jobs"
mcp-server-api   -> ai           "accesses AI features (AI API)"
mcp-server-api   -> encryption   "encrypts and decrypts configuration values"
mcp-server-api   -> scheduler    "manages scheduled configurations"
mcp-server-api   -> sync-actions "executes synchronous component actions"
mcp-server-api   -> query        "executes SQL queries on Snowflake workspaces"
mcp-server-api   -> metastore    "reads metadata and lineage information"
mcp-server-api   -> sandboxes    "manages Data Apps via Data Science API (data-science.{suffix})"

mcp-server-agent -> connection   "verifies tokens, reads Storage API data"
mcp-server-agent -> queue        "creates and monitors component jobs"
mcp-server-agent -> ai           "accesses AI features"
mcp-server-agent -> encryption   "encrypts and decrypts configuration values"
mcp-server-agent -> scheduler    "manages scheduled configurations"
mcp-server-agent -> sync-actions "executes synchronous component actions"
mcp-server-agent -> query        "executes SQL queries on Snowflake workspaces"
mcp-server-agent -> metastore    "reads metadata and lineage information"
mcp-server-agent -> sandboxes    "manages Data Apps via Data Science API"

kai-assistant    -> mcp-server-agent "calls platform tools via MCP (streamable-http transport)"
