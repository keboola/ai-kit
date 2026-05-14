# kai-assistant — dependency analysis

## Deployed components

Three independently deployed apps, all using the same `app-ai-chat` Terraform module
(namespace variable distinguishes them):

- `kai-app-ai-chat` (Deployment): Next.js read-only chat app. Hosted at `ai-chat.{suffix}`.
  Uses Keboola OAuth (KEBOOLA_OAUTH_CLIENT_ID/SECRET) for authentication.
  Repo: `keboola/ai-chat`.

- `kai-app-kai-assistant` (Deployment): Next.js BFF backend for the KAI Assistant chat UI.
  Hosted at `kai-assistant.{suffix}`. No OAuth — callers pass Storage token directly.
  Repo: `keboola/ui` (`apps/kai-assistant-backend`).

- `kai-app-kai-agent` (Deployment): Hono HTTP server (not Next.js). Agentic code executor
  with sandboxed code execution via E2B. Hosted at `kai-agent.{suffix}`.
  Repo: `keboola/ui` (`apps/kai-agent`).

All three have a database-migration Helm hook Job (skipped as C4 component — deploy-time only).

## Inter-service dependencies (all three apps)

- All three -> `connection`: via `KEBOOLA_OAUTH_HOST` / `KEBOOLA_STORAGE_API_URL` /
  `NEXT_PUBLIC_KEBOOLA_URL`. Used for token auth and Storage API calls.
- All three -> `mcp-server-agent`: via `MCP_SERVER_URL` = `https://mcp-agent.{suffix}/mcp`.
  Calls the internal MCP server agent (streamable-http transport).

### kai-agent only

- `kai-app-kai-agent` -> E2B: via `E2B_API_KEY`. Sandboxed Python/JS code execution.

## Cloud LLM provider — cloud-dependent (not modelled per-component)

All three apps use a cloud LLM for Claude. Provider varies by cloud stack:
- AWS + GCP: Google Vertex AI (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_VERTEX_LOCATION`,
  `GOOGLE_VERTEX_PROJECT`)
- Azure: Azure AI Foundry (`FOUNDRY_API_ENDPOINT`, `FOUNDRY_API_KEY`,
  `FOUNDRY_DEPLOYMENT_NAME`, `FOUNDRY_MODEL_NAME`). Toggled via `CLOUD_LLM_PROVIDER`.

Modelled as two separate named resources in `-external.dsl`.

## Named cloud resource dependencies

All three apps use the **same** Terraform module (`app-ai-chat`) reused with different
`namespace` values. Each app gets its own database and object storage bucket but shares
the same PostgreSQL RDS instance (separate databases).

| Resource ID | Type | Evidence |
|---|---|---|
| `rds-postgresql` | Shared PostgreSQL RDS instance | `module.postgresql[0].master_db_instance_address` in `rds_postgresql.tf`. All three apps get separate databases (`ai_chat`, `kai_assistant`, `kai_agent`) on the same RDS instance. |
| `s3-bucket-ai-chat-storage` | S3 bucket (AWS, per-app) | `aws_s3_bucket.ai_chat_storage` in aws/s3.tf. Three separate buckets, one per app namespace. |
| `abs-ai-chat-storage` | Azure Blob Storage account (Azure, per-app) | `azurerm_storage_account.ai_chat_storage` in azure/azure.tf. Three separate storage accounts. |
| `gcs-ai-chat-storage` | GCS bucket (GCP, per-app) | `google_storage_bucket.ai_chat_storage` in gcp/main.tf. Three separate buckets. |
| `kms-key-ai-chat-gcp` | GCP Cloud KMS key (GCP only) | `google_kms_crypto_key.ai_chat_encryption` in gcp/main.tf. Used to encrypt GCS buckets. No equivalent KMS on AWS or Azure. |
| `google-vertex-ai` | Google Vertex AI (AWS + GCP stacks) | `GOOGLE_VERTEX_PROJECT`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_VERTEX_LOCATION`. Claude model via Vertex. |
| `azure-ai-foundry` | Azure AI Foundry (Azure stacks) | `FOUNDRY_API_ENDPOINT`, `FOUNDRY_API_KEY`, `FOUNDRY_DEPLOYMENT_NAME`. Claude model via Azure AI Foundry. |
| `e2b` | E2B sandboxed code execution | `E2B_API_KEY` in kai-agent secret.yaml. `@e2b/code-interpreter` in kai-agent package.json. |

## New resources added to cloud-resources.dsl

- `rds-postgresql`: Shared PostgreSQL RDS instance (AWS)
- `s3-bucket-ai-chat-storage`: S3 bucket for KAI app object storage (AWS)
- `abs-ai-chat-storage`: Azure Blob Storage account for KAI app object storage (Azure)
- `gcs-ai-chat-storage`: GCS bucket for KAI app object storage (GCP)
- `kms-key-ai-chat-gcp`: GCP Cloud KMS key for GCS bucket encryption (GCP only)
- `google-vertex-ai`: Google Vertex AI (external SaaS — Claude via Vertex, AWS + GCP stacks)
- `azure-ai-foundry`: Azure AI Foundry (external SaaS — Claude via Foundry, Azure stacks)
- `e2b`: E2B sandboxed code execution (external SaaS)

## Unresolved

- **Redis**: `redis` package present in both `ai-chat` and `kai-assistant-backend`
  `package.json`, but NOT wired up in any Terraform infra secrets or kbc-stacks secrets.
  Likely dev-only or future dependency. Not modelled.

## Notes

- All three apps are deployed using the same Terraform module `app-ai-chat/aws|azure|gcp`
  with different `namespace` values (`ai-chat`, `kai-assistant`, `kai-agent`). This is why
  there is no separate `app-kai-assistant` or `app-kai-agent` Terraform module.
- `kai-app-ai-chat` uses Keboola OAuth (has `KEBOOLA_OAUTH_CLIENT_ID/SECRET`).
  The other two use direct Storage token auth (no OAuth credentials).
- `kai-app-kai-agent` is a Hono server, not Next.js — different framework from the other two.
- GCP KMS key is used only to encrypt GCS bucket at rest (not application-level encryption).
  Per project conventions this is storage-level encryption — borderline for C4 modelling.
  Included for completeness since it's a service-owned named resource.
- Object storage (S3/ABS/GCS) is used for application file storage (uploads, artifacts).
  Three separate buckets per cloud — one per app. Modelled as shared resource IDs since
  all three apps use the same storage pattern.
- LangSmith (`LANGCHAIN_API_KEY` / `LANGSMITH_API_KEY`) is a tracing/observability tool
  similar to Datadog — not modelled as a C4 dependency.
