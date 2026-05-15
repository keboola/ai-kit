# L3 inter-service relationships for kai-assistant
# Included inside keboolaPlatform block in model.dsl
# Covers three deployed apps: kai-app-ai-chat, kai-app-kai-assistant, kai-app-kai-agent
# All use the same app-ai-chat Terraform module with different namespace values.

kai-app-ai-chat       -> connection        "authenticates users via Keboola OAuth, refreshes OAuth tokens, reads Storage API data"
kai-app-ai-chat       -> mcp-server-agent  "calls platform tools via MCP (MCP_SERVER_URL = mcp-agent.{suffix})"

kai-app-kai-assistant -> connection        "verifies Storage API tokens and reads Storage data"
kai-app-kai-assistant -> mcp-server-agent  "calls platform tools via MCP (MCP_SERVER_URL = mcp-agent.{suffix})"

kai-app-kai-agent     -> connection        "verifies Storage API tokens and reads Storage data"
kai-app-kai-agent     -> mcp-server-agent  "calls platform tools via MCP (MCP_SERVER_URL = mcp-agent.{suffix})"
