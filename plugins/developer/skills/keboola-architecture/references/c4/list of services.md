Updated **final inventory — 30 containers:**

| Container | C4 ID | Repository/ies | Language | API | Notes |
|---|---|---|---|---|---|
| CONNECTION | `connection` | `connection` | PHP | [Storage API](https://keboola.docs.apiary.io/) · [Management API](https://api.keboola.com/?service=manage#overview) | Monolith; includes Storage + Management (`/manage`); authorization used by everyone |
| UI | `ui` | `ui` | TypeScript | — | Frontend monorepo |
| API SERVICE | `api` | `api-service` | TypeScript | — | Static SPA serving OpenAPI docs; no runtime dependencies |
| QUEUE | `queue` | `job-queue`, `job-queue-daemon`, `job-runner` | PHP | [Queue API](https://app.swaggerhub.com/apis-docs/keboola/job-queue-api) | Includes docker-runner, internal API, gelf-logger-server |
| SYNC ACTIONS | `sync-actions` | `runner-sync-api` | PHP | [Sync Actions API](https://app.swaggerhub.com/apis/odinuv/sync-actions) | |
| SANDBOXES | `sandboxes` | `sandboxes-service`, `keboola-as-code`, `keboola-operator`, `sandboxes` | PHP/Go | [Sandboxes API](https://data-science.keboola.com/docs/swagger.yaml) | Four sub-systems: sandboxes-service (PHP REST API), apps-proxy (Go, keboola-as-code), keboola-operator (Go K8s operator), sandboxes component (ephemeral PHP job) |
| STREAM | `stream` | `keboola-as-code` | Go | [Stream API](https://stream.keboola.com/v1/documentation/) | cmd/stream in keboola-as-code monorepo |
| TEMPLATES | `templates` | `keboola-as-code` | Go | [Templates API](https://templates.keboola.com/v1/documentation/) | cmd/templates-api in keboola-as-code monorepo |
| CLI | `cli` | `keboola-as-code` | Go | — | cmd/kbc in keboola-as-code monorepo; client-side tool, not a server |
| MCP SERVER | `mcp-server` | `mcp-server` | Python | [MCP docs](https://developers.keboola.com/integrate/mcp/) | `mcp-server-agent` is same image, two deployments; open source |
| AI | `ai` | `ai-service` | PHP | [AI API](https://ai.keboola.com/docs/swagger.yaml) | |
| KAI ASSISTANT | `kai-assistant` | `ai-chat`, `ui` | TypeScript | — | Three apps: ai-chat, kai-assistant (BFF), kai-agent |
| EDITOR | `editor` | `editor-service` | PHP | [Editor API](https://editor.keboola.com/docs/swagger.yaml) | |
| OMNISEARCH | `omnisearch` | `omnisearch-and-metadata-engine` | Python | — (FastAPI, self-hosted) | Lineage + metadata engine; serves at metastore.{suffix}; internally "Impact AI" |
| IMPORT | `import` | `sapi-importer` | PHP | [Importer API](https://app.swaggerhub.com/apis-docs/keboola/import) | |
| OAUTH | `oauth` | `oauth-api`, `oauth-service`, `oauth-api-serverless` | JS/PHP | [OAuth Broker API](https://oauthapi3.docs.apiary.io/) | 3 versions in parallel |
| ENCRYPTION | `encryption` | `encryption-api` | PHP | [Encryption API](https://keboolaencryption.docs.apiary.io/) | |
| VAULT | `vault` | `vault` | PHP | [Vault API](https://vault.keboola.com/docs/swagger.yaml) | Variables & credentials storage |
| NOTIFICATION | `notification` | `notification-service` | PHP | [Notifications API](https://app.swaggerhub.com/apis/odinuv/notifications-service) | |
| BILLING | `billing` | `billing-api` | PHP | [Billing API](https://keboolabillingapi.docs.apiary.io/) | |
| SCHEDULER | `scheduler` | `scheduler` | PHP | [Scheduler API](https://app.swaggerhub.com/apis/odinuv/scheduler) | |
| QUERY | `query` | `go-monorepo` | Go | [Query API](https://query.keboola.com/api/v1/documentation) | services/query; AES encryption (not cloud KMS) |
| METASTORE | `metastore` | `go-monorepo` | Go | — | services/metastore; gated on `metastore_enabled`; implemented but not enabled |
| GIT SERVICE | `git-service` | `go-monorepo` | Go | — | services/git-service; wraps Forgejo; not yet commissioned |
| FORGEJO | `forgejo` | — (upstream Bitnami Helm chart) | — | — | Self-hosted Git; not yet commissioned |
| NATS | `nats` | — | — | — | kbc-stacks chart has no templates; not yet commissioned |
| SKILL REGISTRY API | `skill-registry` | `skill-registry-api` | PHP | — | PHP/Symfony + React frontend; own auth (X-API-TOKEN), no Connection dependency; OAuth broker for GitHub/Google/HubSpot/Slack/Salesforce; deployed on canary-orion only |
| SKILL REGISTRY MCP SERVER | `skill-registry-mcp-server` | `skill-registry-mcp-server` | Python | — | Python MCP server; calls Skill Registry API; kbc-stacks chart has no templates |
| ELASTICSEARCH | `connection-elasticsearch`, `job-queue-elasticsearch` | — | — | — | Two self-hosted instances; no source repo |
| DEVELOPER PORTAL | — | `developer-portal`, `developer-portal-ui` | JavaScript | [Developer Portal API](https://kebooladeveloperportal.docs.apiary.io/) | Satellite system |
| TELEMETRY | — | `telemetry-raw-projects`, `telemetry-billing-gcp`, `embed-telemetry`, `gooddata-cn-provisioning` | — | — | Satellite system |
