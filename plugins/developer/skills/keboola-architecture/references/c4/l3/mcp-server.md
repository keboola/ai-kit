# mcp-server — dependency analysis

## Deployed components
- `mcp-server` (Deployment, namespace `mcp-server`): Public-facing FastMCP server.
  OAuth-authenticated (KBC_OAUTH_CLIENT_ID/SECRET/JWT_SECRET). Transport: `http-compat`.
  Serves external AI agents (Cursor, Claude Desktop, Windsurf, etc.).

- `mcp-server-agent` (Deployment, namespace `mcp-server-agent`, 2 replicas): Internal FastMCP
  server. Same image (`keboola/mcp-server`), dedicated endpoint for kai-assistant.
  Transport: `streamable-http`. No OAuth secrets — caller (kai-assistant) passes Storage
  token directly. Deployed from kbc-stacks `apps/mcp-server-agent/`.

## Inter-service dependencies
All service URLs are derived at runtime in `KeboolaClient.__init__` by substituting
the `connection.` prefix in `storage_api_url`. Both `mcp-server` and `mcp-server-agent`
have identical service dependencies — same `KeboolaClient` code path, same set of APIs.
No service URLs appear in ENV or infra_secrets — invisible to ENV scanning.

| Target container | URL derivation |
|---|---|
| `connection` | `connection.{suffix}` via `AsyncStorageClient` |
| `queue` | `queue.{suffix}` via `JobsQueueClient` |
| `ai` | `ai.{suffix}` via `AIServiceClient` |
| `encryption` | `encryption.{suffix}` via `EncryptionClient` |
| `scheduler` | `scheduler.{suffix}` via `SchedulerClient` |
| `sync-actions` | `sync-actions.{suffix}` via `SyncActionsClient` |
| `query` | `query.{suffix}` via `QueryServiceClient` (in `workspace.py`) |
| `metastore` | `metastore.{suffix}` via `MetastoreClient` |
| `sandboxes` | `data-science.{suffix}` via `DataScienceClient` (Data Apps API) |

`kai-assistant` -> `mcp-server-agent`: kai-assistant calls mcp-server-agent as its
MCP tool provider (streamable-http transport).

## Named cloud resource dependencies
None. No Terraform module for either deployment.

## Unresolved
None.

## Notes
- `mcp-server` and `mcp-server-agent` are the same Docker image deployed twice with
  different CLI args (`--transport http-compat` vs `--transport streamable-http`),
  different namespaces, and different auth models (OAuth vs direct token).
- `data-science.{suffix}` is the Data Science / Data Apps API served by `sandboxes-service`,
  NOT a separate container.
- `KBC_OAUTH_CLIENT_ID/SECRET/JWT_SECRET` in `mcp-server` only — OAuth credentials for
  authenticating external users. `mcp-server-agent` has no OAuth secrets.
