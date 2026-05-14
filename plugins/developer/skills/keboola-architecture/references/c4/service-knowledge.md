# C4 Architecture — Service-Specific Knowledge

This file contains knowledge about specific Keboola repositories that cannot be
automatically detected from Terraform, kbc-stacks, or services.yaml sources. It
is referenced by the analyze-service skill during scanning (Step 0).

The file has two parts:

1. **Per-service entries** (sorted alphabetically by GitHub repository name) —
   non-obvious facts and quirks specific to one repository or service.
2. **Architecture-wide conventions** — modelling decisions and patterns that
   apply across the platform. The skill files refer to these instead of restating
   them; the analyzer should always read them in addition to the per-service entry.

**What does NOT belong here:** pure enumerations of facts already encoded in the C4
model (`l3/*.dsl`, `l3/cloud-resources.dsl`, `model/model.dsl`, `views/views.dsl`).
The model is the source of truth for what elements exist, which relationships are
modelled, and how things are tagged. Maintaining parallel lists in this file creates
drift — if an analyzer can derive the answer with `grep` over the DSL files, do not
duplicate it here. Tables with substantial non-model context (rationale, source-code
references, naming conventions, behavioural quirks) are fine; tables that just
enumerate model edges are not.

**What DOES belong here:** the *why* behind modelling decisions, non-obvious
behaviours that a Terraform / Helm / source scan would miss, naming quirks (repo
name ≠ chart name ≠ image name), deprecated patterns to ignore, scanning hints, and
the rationale for architecture-wide conventions.

The intent is to keep this knowledge here temporarily until it can be moved into
each repository's own documentation; the architecture-wide conventions will
eventually become an ADR.

---

## ai-chat / kai-assistant / kai-agent (repo: keboola/ai-chat + keboola/ui)

### Three apps, one Terraform module — the naming mess explained

Three independently deployed apps, all provisioned by the same Terraform module
(`app-ai-chat`) with different `namespace` values. There is no separate `app-kai-assistant`
or `app-kai-agent` Terraform module — searching for those will find nothing.

| kbc-stacks chart | namespace | Source repo | Framework |
|---|---|---|---|
| `ai-chat` | `ai-chat` | `keboola/ai-chat` | Next.js |
| `kai-assistant` | `kai-assistant` | `keboola/ui` (`apps/kai-assistant-backend`) | Next.js BFF |
| `kai-agent` | `kai-agent` | `keboola/ui` (`apps/kai-agent`) | **Hono** (not Next.js) |

Repo name ≠ image name ≠ chart name ≠ product name. When scanning, always look up the
chart name in kbc-stacks, not the GitHub repo name.

### How to find their Terraform config

All three point to `source = "../../modules/app-ai-chat/aws|azure|gcp"`.
Stack-level wiring: `aws/stage-30/app_ai_chat.tf`, `app_kai_assistant.tf`, `app_kai_agent.tf`.
The module has three cloud variants (aws/, azure/, gcp/) — read all three for the full picture.

### Shared vs per-app resources

**Shared (one instance, three databases):**
- PostgreSQL (`postgresql-instance`): one shared PostgreSQL instance, databases `ai_chat`,
  `kai_assistant`, `kai_agent` initialized by the `kubernetes-postgresql-init` module.
  See "Managed databases — collapsed across cloud providers" in the architecture-wide
  conventions section for why this element has no provider tag.

**Per-app (separate resource per namespace):**
- Object storage: S3 (AWS) / Azure Blob Storage (Azure) / GCS (GCP) — one bucket/account per app.
- GCP KMS key (GCP only): `google_kms_crypto_key.ai_chat_encryption` — used for GCS bucket
  encryption at rest only (not application-level). No AWS/Azure KMS equivalent for these apps.

### Cloud LLM provider — varies by cloud stack

- AWS + GCP stacks: Google Vertex AI (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_VERTEX_LOCATION`,
  `GOOGLE_VERTEX_PROJECT`)
- Azure stacks: Azure AI Foundry (`FOUNDRY_API_ENDPOINT`, `FOUNDRY_API_KEY`,
  `FOUNDRY_DEPLOYMENT_NAME`, `FOUNDRY_MODEL_NAME`). Toggled via `CLOUD_LLM_PROVIDER` env var.

Both are modelled as `CloudResource`-tagged named instances (not Vendor aggregates) since they
are specific managed AI platform deployments.

### kai-agent only: E2B

`kai-app-kai-agent` is the only component using E2B (`E2B_API_KEY`, `@e2b/code-interpreter`).
E2B is an external SaaS vendor for sandboxed code execution. It is tagged `"Vendor"` and
appears on the **L1 system context view** as a platform-level external dependency, alongside
SendGrid, Stripe, and GitHub.

### ai-chat only: Keboola OAuth and OAuth token refresh

`kai-app-ai-chat` has `KEBOOLA_OAUTH_CLIENT_ID` / `KEBOOLA_OAUTH_CLIENT_SECRET` — it uses
the platform's OAuth service for user authentication. The other two apps use direct Storage
token auth. This is visible in ai-chat's `secret.yaml` vs the other two.

After initial OAuth login, `ai-chat` also calls `KEBOOLA_OAUTH_HOST/oauth/token` with
`grant_type=refresh_token` to refresh expired access tokens (lib/db/tokens.ts:
`refreshKeboolaToken`). This is a direct HTTP call to Connection (`connection.{suffix}`)
using the OAuth client credentials. The relationship is already modelled as
`kai-app-ai-chat -> connection`.

### TOKEN_ENCRYPTION_KEY — application-managed symmetric encryption

`TOKEN_ENCRYPTION_KEY` is a 32-byte AES-GCM key (base64-encoded) injected as an infra secret.
It is used by `lib/crypto/token-encryption.ts` via the Web Crypto API (`crypto.subtle`) to
encrypt Keboola OAuth access tokens and refresh tokens before storing them in PostgreSQL.
This is called on every OAuth login (`storeKeboolaTokens`) and every API request
(`getValidKeboolaToken` -> `safeDecryptToken`).

This is application-managed encryption, NOT cloud KMS — see "Application-managed encryption"
in architecture-wide conventions. Do NOT add a `kms-key-ai-chat-aws/azure` C4 cloud resource
relationship for this.

### Redis — non-production, do not model

Both `ai-chat` and `kai-assistant-backend` list `redis` in `package.json` dependencies, but
Redis is NOT present in any Terraform infra secrets or kbc-stacks secret templates.
Confirmed non-production. Do not add a Redis resource or relationship.

### LangSmith — observability only, do not model

`LANGCHAIN_API_KEY` / `LANGSMITH_API_KEY` appear in all three apps' secrets. LangSmith is an
LLM observability/tracing tool equivalent to Datadog for AI workflows. See "Observability
tooling" in architecture-wide conventions.

### C4 element IDs

Container: `kai-assistant`
Components: `kai-app-ai-chat`, `kai-app-kai-assistant`, `kai-app-kai-agent`
L3 files: `kai-assistant.dsl`, `kai-assistant-external.dsl`, `kai-assistant.md`

---

## ai-service

### appSecrets ENV mappings
| ENV key | Target container ID | Notes |
|---|---|---|
| `PROMPT_RECORD_URL` | `stream` | Stream service ingest endpoint for recording prompts |
| `FEEDBACK_RECORD_URL` | `stream` | Stream service ingest endpoint for recording feedback |

---

## connection

### Three distinct APIs — one deployed process
The `connection-api` Deployment serves three logically separate APIs via Zend front controller routing:

| Component ID | Route prefix | Auth scope | Purpose |
|---|---|---|---|
| `connection-storage-api` | `/v1`, `/v2` | Storage token (project-scoped) | Core data-plane: buckets, tables, files, tokens, events, configurations, workspaces, dev branches |
| `connection-manage-api` | `/manage` | Manage token (org-scoped) | Projects, organisations, maintainers, storage backends, users, platform metadata |
| `connection-payg-api` | `/pay-as-you-go` | Session/super token | PAYG billing: Stripe payments, credits, top-up config, registration wizard |

Route registration: `Bootstrap.php::_initRoutes()` — Storage via `Storage_Service_RouteFactory`,
Manage via `Manage_Service_RouteFactory`, PAYG as the `pay-as-you-go` Zend module.

### Relationship assignment by component
- Storage backends (Snowflake, BigQuery, etc.) -> `connection-storage-api`
- Cloud queues and event topics (SQS, SNS, Service Bus, Event Grid, Pub/Sub) -> `connection-storage-api`
- Cloud file storage (S3, ABS, GCS) -> `connection-storage-api`
- Cloud databases (RDS, Azure DB, Cloud SQL) -> both `connection-storage-api` and `connection-manage-api` (shared MySQL)
- Stripe -> `connection-payg-api` (billing layer)
- Sandboxes API -> `connection-manage-api` (CLI maintenance commands)
- Queue Public API -> `connection-worker-triggers` (table trigger fires component jobs)

### SendGrid — used by all three APIs and the certificate-rotation worker

SendGrid is NOT exclusively manage-api. All three Connection APIs and the certificate-rotation
worker send email:

| Component | Email type | Source class |
|---|---|---|
| `connection-storage-api` | Token sharing, merge request lifecycle notifications | `ShareTokenService`, `MergeRequestEmails` |
| `connection-manage-api` | Project invitations, Snowflake Partner Connect welcome | `ProjectsService`, `SPCSingleEmailService` |
| `connection-payg-api` | PAYG registration welcome email | `pay-as-you-go/service/Project.php` |
| `connection-worker-certificate-rotation` | SAML2 certificate expiry warnings to backend technical owners | `Saml2CertificateRotationEmails` |

All go through the same `email.transport` (`Zend_Mail_Transport_Abstract` / `EmailSender`).
Model four separate `-> sendgrid` relationships in `connection-external.dsl`.

### Scheduler-based workers — how to find their dependencies

The three workers `connection-worker-user-tasks-scheduler`, `connection-worker-monitoring`,
and `connection-worker-certificate-rotation` do NOT use Symfony Messenger transports in the
standard sense. They use the Symfony Scheduler component (`symfony/scheduler`), which
registers tasks via PHP attributes rather than `messenger.yaml`. The string after
`messenger:consume` in `values.yaml` (e.g. `scheduler_monitoring`) is the name of the
scheduler schedule, not a queue name. To find what a scheduler worker does:

1. Search the codebase for `#[AsCronTask(schedule: '<name>')]` or `#[AsSchedule('<name>')]`
   matching the schedule name (strip the `scheduler_` prefix).
2. The PHP class bearing that attribute is the command/handler that runs under this worker.
   Read that class to determine its dependencies.

Mapping of workers to source:

| Worker | Schedule name | Source class |
|---|---|---|
| `connection-worker-user-tasks-scheduler` | `user_tasks` | `ScheduledTaskProvider` |
| `connection-worker-monitoring` | `monitoring` | `StorageBackendHealthCheckCommand` |
| `connection-worker-certificate-rotation` | `certificate-rotation` | `CheckSaml2CertificatesExpirationCommand`, `RefreshCertificateForProject`, `RefreshCertificateForBackend` |

`user_tasks`: Reads `ScheduledTask` entities from MySQL, enqueues storage jobs. Dependencies: MySQL + cloud queues.
`monitoring`: Live connection tests to Snowflake/BigQuery backends. Dependencies: MySQL + Snowflake + BigQuery.
`certificate-rotation`: Direct DDL on customer Snowflake accounts + SAML2 certificate expiry emails. Dependencies: MySQL + Snowflake + SendGrid.

### connection-cronjob-project-purge-scheduler — enqueues via internal commands queue

`ProjectPurgeScheduler` calls `CommandsService.enqueueCommand('storage:project-purge', [...])` which
dispatches to `QueueServiceInterface::QUEUE_COMMANDS` — the `connection-commands` queue
(SQS/Service Bus/Pub/Sub), consumed by `connection-worker-commands`.

C4 relationships: `-> mysql-instance-connection` (reads projects) +
`-> sqs/servicebus/pubsub-queue-connection-commands` (enqueues purge commands).

### connection-cronjob-token-expiration — MySQL only

`TokenExpirator` performs pure MySQL operations: deletes expired storage/manage tokens, expired
project-admin associations, expired invitations, expired join requests, and admin sessions.
No external service calls. Only dependency: `mysql-instance-connection`.

### connection-cronjob-release-staled-locks — uses K8s API

The only Connection component that calls the Kubernetes API at the application level. Lists
pods to identify stale locks held by terminated/failed worker pods, then releases them.
Matches the rule in the "Kubernetes clusters" architecture-wide convention; modelled with
`-> aws-eks/azure-aks/gcp-gke`. This is the only Keboola service outside `queue` and
`sandboxes` to touch K8s, which is why it's worth flagging here.

### Connection internal queues — real SQS/Service Bus/Pub/Sub resources

Connection owns 7 internal queues provisioned by its own Terraform module
(`app-connection/aws/queue_*.tf`, `app-connection/azure/messaging.tf`, `app-connection/gcp/messaging.tf`).
All are Pattern A (Connection both publishes and its workers consume).

| Logical name (QueueServiceInterface const) | C4 resource ID prefix | Consumer component |
|---|---|---|
| `main` (QUEUE_MAIN) | `*-queue-connection-main` | `connection-worker-main` |
| `commands` (QUEUE_COMMANDS) | `*-queue-connection-commands` | `connection-worker-commands` |
| `eventsElastic` (QUEUE_EVENTS_ELASTIC) | `*-queue-connection-events-elastic` | `connection-worker-events-elastic` |
| `auditLog` (QUEUE_AUDIT_LOG) | `*-queue-connection-worker-audit-log` | `connection-worker-audit-log` |
| `tableTriggers` (QUEUE_TABLE_TRIGGERS) | `*-queue-connection-table-triggers` | `connection-worker-triggers` |
| `searchIndex` (QUEUE_SEARCH_INDEX) | `*-queue-connection-search-index` | `connection-worker-search-index` |
| `jobStats` (QUEUE_JOB_STATS) | *(provisioned but unused)* | — |

Note: `main` queue is also written to by `connection-worker-user-tasks-scheduler` (scheduled tasks).
Note: `commands` queue is also written to by `connection-cronjob-project-purge-scheduler`.

**Important — audit-log ID uses `-worker-` infix:** The internal audit-log queue C4 IDs are
`sqs/servicebus/pubsub-topic-connection-worker-audit-log`. This distinguishes them from the
cross-service `sns/eventgrid/pubsub-topic-connection-audit-log` fan-out topics. The `-worker-`
infix was necessary to avoid an ID clash in Structurizr.

### Connection internal SNS/EventGrid topics are NOT cross-service fan-out

Connection has three internal SNS topics on AWS (and equivalents on Azure/GCP):
- `SNS__EVENTS_TOPIC__ARN` (`events_topic.tf`) — fans out to `QueueEventsElastic` and `QueueTableTriggers` (both internal)
- `SNS__AUDIT_LOG_EVENTS_TOPIC__ARN` (`audit_log_topic.tf`) — fans out to `QueueAuditLogEvents` (internal)
- `SNS__SEARCH_INDEX_TOPIC__ARN` (`search_index_topic.tf`) — internal

All three are internal SNS->SQS delivery mechanisms within Connection only. They are NOT the
cross-service `sns-topic-connection-events` / `sns-topic-connection-audit-log` topics.

The cross-service SNS topics are provisioned in Connection's Terraform and their ARNs are passed
as output variables to subscriber service Terraform modules. Subscriber services (editor, vault,
oauth) provision their own SQS queues and subscribe via `aws_sns_topic_subscription` in their
own `queue_connection.tf` files.

**Scanning implication:** When scanning editor/vault/oauth Terraform, `var.connection_events_topic_arn`
and `var.connection_audit_log_topic_arn` reference Connection's cross-service topics. The
subscriber-owned SQS queues (e.g. `sqs-queue-editor-connection-events`) are C4 named resources
owned by the subscriber service, not by Connection.

### connection-cronjob-sync-apps — inter-stack dependency (unusual)
`ui-apps:sync` calls `GET /manage/ui-apps` on a configurable host (default: `https://connection.keboola.com`)
via `GuzzleClient`. This is an **inter-stack dependency** — a running Connection stack calling a different
Connection stack (the reference/production stack) to fetch canonical UI app definitions.

This is architecturally unusual: it is the only place in the platform where a service on one stack makes
a runtime HTTP call to a hardcoded URL on another stack. It is NOT modelled as an inter-service dependency
(there is no C4 element for "another Connection stack"). The only relationship modelled is:
`connection-cronjob-sync-apps -> mysql-instance-connection` (writes the synced app definitions locally).

Do NOT add a self-referential relationship or a relationship to `connection` from `connection-cronjob-sync-apps`.

### keboolaServices parameter — three actual getService call sites
The `%keboolaServices%` Symfony parameter is internally consumed via `stackInfo->getService(key)` in
exactly three non-test production files:

| File | Key | Client | Nature |
|---|---|---|---|
| `EventTriggerFactory.php` | `'queue'` | `Keboola\JobQueueClient\Client` | Runtime — every table trigger fire |
| `DefaultSandboxManageClientFactory.php` | `'sandboxes'` | `Keboola\Sandboxes\Api\ManageClient` | CLI — Snowflake hostname change command |
| `ResetSandboxesPasswordForProject.php` | `'sandboxes'` | `Keboola\Sandboxes\Api\ManageClient` | CLI — BYODB migration tool |

The `oauth`, `import`, `syrup` keys are never consumed via `getService` internally — pass-through only.
Do not model as inter-service dependencies.

### Storage backends
- Snowflake — Active. BigQuery — Active. Synapse — Legacy. Exasol — Legacy. Supabase — Uncommissioned.

Model `synapse` and `exasol` with `"Legacy"` tag, `supabase` with `"Uncommissioned"` tag.

### Developer Portal sync
`connection-cronjob-sync-components` (`storage:component:sync-dev-portal`) fetches component
definitions from `devPortal.url` via `Keboola\DeveloperPortal\Client`, then writes them to
the `apis` MySQL table via `Model_Apis::replace()`.

Dependencies: `devPortalApi` (read) + `mysql-instance-connection` (write).

The `devPortalApi` relationship must be in `connection-external.dsl` (top-level model), not
`connection.dsl` (inside keboolaPlatform), because `devPortalApi` is outside `keboolaPlatform`.
The MySQL relationship is also in `connection-external.dsl` alongside the rest of the MySQL entries.

### Stripe
`PayAsYouGo_Service_Stripe` for credit top-ups. Model as `connection-payg-api -> stripe`.

### Elasticsearch — Helm-managed, not Terraform
Elasticsearch config is injected at deploy-time by the elasticsearch chart cert-copy job.
Not in Terraform infra_secrets.

### No KMS dependency
Connection uses its own symmetric `ENCRYPTION_KEYS__*` env vars. Does NOT use
`Keboola\ObjectEncryptor` / cloud KMS. See "Application-managed encryption" in
architecture-wide conventions.

---

## go-monorepo (services/query)

### Single Terraform module variant — no aws/azure/gcp split

`app-query-service` has only a single `main.tf` (no aws/, azure/, gcp/ subdirectories).
This is because the module only creates a K8s namespace and injects PostgreSQL credentials
from the shared `postgresql-instance`. No cloud-specific resources are needed.
When scanning, do not expect cloud subdirectories — read `main.tf` directly.

### Application-managed AES encryption

`QUERY_ENCRYPTION_AES_SECRET_KEY` is a 32-byte AES-256 key injected via a dedicated
Kubernetes Secret (`query-service-env-secrets`). Used by `internal/encryption` package
(`go-cloud-encrypt`) to encrypt workspace credentials at rest in PostgreSQL.

`config.go` explicitly validates `oneof=none aes` — there is no cloud KMS provider option
in this service. The comment "Do not use in production" in the config struct refers to the
AES provider being the simpler option, but AES is what is deployed (kbc-stacks hardcodes
`QUERY_ENCRYPTION_PROVIDER=aes`).

This is application-managed encryption, NOT cloud KMS — see "Application-managed encryption"
in architecture-wide conventions. Do NOT add a cloud KMS resource relationship for this.

### PostgreSQL queue — no inter-component HTTP calls

The coordinator and workers communicate exclusively via PostgreSQL LISTEN/NOTIFY and
partitioned job tables. There are no direct HTTP calls between `query-service-coordinator`
and `query-service-worker`. All three Deployments (api, coordinator, worker) each get the
full `QUERY_DB_*` credentials and connect directly to PostgreSQL independently.

### Same binary, different args

All components use a single Docker image from `go-monorepo`. Differentiated by `args`:
- `api-deployment.yaml`: `args: ["api"]` — `/app/service`
- `coordinator-deployment.yaml`: `args: ["coordinator"]` — `/app/service`
- `worker-deployment.yaml`: `args: ["worker"]` — `/app/service`
- `cronjob-partition-maintenance.yaml`: separate binary `/app/partition-maintenance`

---

## job-queue

### Structure — monorepo with four deployment groups
This is a monorepo (`https://github.com/keboola/job-queue`).
The `queue` L2 container maps to four separately provisioned deployment groups.

Group 1 — Public API (`apps/public-api`): single Deployment, sole external-facing component.

Group 2 — Internal API (`apps/internal-api` + kbc-stacks `apps/job-queue-internal-api`):
one Deployment plus CronJobs and Logstash. Always scan kbc-stacks templates directory.
`INTERNAL_API_URL` is internal wiring within the `queue` container — NOT cross-container.

Group 3 — Runner (`apps/service-container`, `apps/gelf-logger-server`,
`apps/input-mapping-component`, `apps/output-mapping-component`, legacy `keboola/job-runner`):
ephemeral per-job pods, no Terraform infra_secrets, credentials injected by daemon.
service-container -> vault; gelf-logger-server -> connection. See `job-runner` section.

Group 4 — Daemon (`keboola/job-queue-daemon`, separate repo). Scan separately.

### Inter-service dependency rules
- `queue-public-api` -> `connection`: via `STORAGE_API_URL` + `Keboola\StorageApiBranch` + `Keboola\ManageApi\Client`.
- `queue-internal-api` -> `connection`: via `ServiceClient.getConnectionServiceUrl()`.
- `queue-internal-api` -> `elasticsearch`: via `ELASTICSEARCH_URL` (self-hosted container — .dsl not -external.dsl).
- Logstash -> `elasticsearch`: output plugin.
- Replication check CronJob -> `elasticsearch`: checks lag.
- Runner components -> `connection`: via `Keboola\StorageApiBranch`.
- Runner components -> `vault`: via `Keboola\VaultApiClient`.
- GELF logger -> `connection`: via `STORAGE_API_URL`.

---

## job-queue-daemon

### Structure — data-driven deployments
`templates/deployments.yaml` and `templates/cronjobs.yaml` iterate over `.Values` lists.
Always read `values.yaml` to discover actual deployed components.

### Inter-service dependency rules
- `Keboola\JobQueueInternalClient\Client` with `DAEMON_INTERNAL_QUEUE_API_URL` -> `queue-internal-api`.
- `Keboola\NotificationClient\*` -> `notification`.
- `Keboola\BillingApi\ClientFactory` -> `billing` (conditional on `BILLING_ENABLED`, still model it).
- `VAULT_API_URL` in `App\Daemon\RunnerConfigurationFactory` -> `vault`.
- `Keboola\StorageApiBranch` + `Keboola\ManageApi\Client` using `STORAGE_API_URL_INTERNAL` -> `connection`.
- `RUNNER_INTERNAL_QUEUE_API_URL` in `K8sManifestsFactory` — injected into spawned pods, NOT a daemon dependency.
- DB/flow cleanup CronJobs -> `queue-internal-api`.
- `daemon-cron-pod-cleanup` makes K8s API calls to delete orphaned pods. NOT a Keboola inter-service dependency — modelled as `-> aws-eks/azure-aks/gcp-gke` per the "Kubernetes clusters" architecture-wide convention.

### External dependency rules
- `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` — ECR auth, deprecated. Do NOT model as storage dependency.
- `JOBS_TO_START_QUEUE_DSN`, `FLOW_JOBS_TRANSITION_QUEUE_DSN` — daemon-owned Pattern A queues.
- `Keboola\ObjectEncryptor` uses the shared job-runner KMS key, NOT the `encryption` container.

---

## job-runner

### Structure — per-job ephemeral container, not a persistent service
No kbc-stacks entry, no Terraform module. Spawned per-job by daemon as ephemeral pod.
Credentials injected by daemon via `App\Daemon\RunnerConfigurationFactory`.
The ECS mention in README is outdated — runs in K8s.

C4 modelling: component of `queue` container (Group 3). Component ID: `queue-job-runner`.

### Inter-service dependency rules
- `connection`: `STORAGE_API_URL` via `Keboola\StorageApiBranch`.
- `queue` (internal-api): `JOB_QUEUE_URL` via `Keboola\JobQueueInternalClient\Client`.
- `vault`: `VAULT_API_URL` via `Keboola\VaultApiClient\Variables\VariablesApiClient`.
- `Keboola\ObjectEncryptor` -> shared job-runner KMS key, NOT the `encryption` container.

No infra_secrets to scan — credentials are injected by daemon.

---

## keboola-as-code

### No Terraform infrastructure — all config from ConfigMap

`templates-api` has no Terraform module. No infra_secrets, no KMS keys, no cloud queues, no
managed databases, no object storage. All config comes from a ConfigMap in kbc-stacks `_helpers.tpl`:
- `TEMPLATES_STORAGE_API_HOST` = `https://connection.{hostnameSuffix}` (only inter-service dependency)
- `TEMPLATES_API_PUBLIC_URL` = `https://templates.{hostnameSuffix}` (self-referential)

Scanning Terraform will find nothing for this service. Go directly to kbc-stacks.

### GitHub is an operational runtime dependency

`templates-api` clones Git repositories at runtime to read template definitions.
Hardcoded in `internal/pkg/template/repository/default.go`:
- `https://github.com/keboola/keboola-as-code-templates.git` (main, beta, dev branches)
- `ComponentsTemplateRepositoryURL` (main, beta branches)

Model as `templates-api -> github` in `templates-api-external.dsl`. GitHub is a `Vendor`-tagged
softwareSystem in `external-systems.dsl` and appears on the L1 system context view.

### etcd is a co-deployed Helm sub-chart, not a separate service

`templates-api-etcd` (3-replica Bitnami etcd) is a Helm sub-chart co-deployed with templates-api,
not a separate kbc-stacks app. Model as a `SelfHosted`-tagged component inside the `templates`
container. API degrades gracefully without it (loses write atomicity).

---

## mcp-server

### All service URLs derived from storage_api_url — invisible to ENV scanning

`mcp-server` has no Terraform module and no infra_secrets. All inter-service URLs are
derived at runtime in `KeboolaClient.__init__` (`src/keboola_mcp_server/clients/client.py`)
by replacing the `connection.` prefix with the target service prefix:

| Python variable | URL pattern | C4 container |
|---|---|---|
| `queue_api_url` | `queue.{suffix}` | `queue` |
| `ai_service_api_url` | `ai.{suffix}` | `ai` |
| `encryption_api_url` | `encryption.{suffix}` | `encryption` |
| `scheduler_api_url` | `scheduler.{suffix}` | `scheduler` |
| `sync_actions_api_url` | `sync-actions.{suffix}` | `sync-actions` |
| `metastore_api_url` | `metastore.{suffix}` | `metastore` |
| `data_science_api_url` | `data-science.{suffix}` | `sandboxes` (see below) |
| (in workspace.py) | `query.{suffix}` | `query` |

Do NOT scan ENV or infra_secrets for inter-service dependencies — read `KeboolaClient.__init__` directly.

### data-science.{suffix} maps to sandboxes container

`DataScienceClient` at `data-science.{suffix}` is served by the `sandboxes` container.
Model as: `mcp-server -> sandboxes`.

### Self-hosted / local deployment — same code, different deployment context

`mcp-server` is open-source and installable via `pip` or `uvx`. Only the hosted deployment
(kbc-stacks) is modelled in C4. Do NOT add a separate C4 container for local/self-hosted.

### mcp-server-agent — dedicated internal endpoint for kai-assistant

`mcp-server-agent` is a separate Kubernetes Deployment (namespace `mcp-server-agent`, 2 replicas)
using the same image but configured differently:

| | `mcp-server` | `mcp-server-agent` |
|---|---|---|
| Transport | `--transport http-compat` | `--transport streamable-http` |
| Auth | OAuth (KBC_OAUTH_CLIENT_ID/SECRET/JWT_SECRET) | None — caller passes Storage token directly |
| Consumer | External AI agents (Cursor, Claude, Windsurf) | kai-assistant (internal) |
| Replicas | 1 | 2 |

C4 component IDs: `mcp-server-api` and `mcp-server-agent`. The `kai-assistant -> mcp-server-agent`
relationship is in `mcp-server.dsl`.

---

## oauth-service

### Legacy migration ENV keys — do not model

`oauth-service` carries temporary cross-account dependencies for migrating data from legacy implementations.
These are wired via `LEGACY_OAUTH_*` ENV keys and must NOT be modelled — marked as TEMPORARY in Terraform.
The `oauth-service-legacy-oauth-migration` Job is a helm hook — skip when enumerating components.

AWS keys: `LEGACY_OAUTH_DYNAMO_*`, `LEGACY_OAUTH_KMS_ARN` (cross-account DynamoDB + KMS from legacy Lambda).
Azure keys: `LEGACY_OAUTH_COSMOSDB_*`, `LEGACY_OAUTH_KEY_VAULT_*` (Cosmos DB + Key Vault from legacy Node.js).

### Three parallel implementations — two being phased out

| Repo | Language | Status |
|---|---|---|
| `https://github.com/keboola/oauth-api` | Node.js | Being phased out |
| `https://github.com/keboola/oauth-api-serverless` | Node.js | Being phased out |
| `https://github.com/keboola/oauth-service` | PHP (Symfony) | Active/canonical |

`oauth-service-serverless-proxy` is conditional nginx routing only — no service dependencies.
Do NOT model it as a C4 component.

All three repos in the `repos` property: `"oauth-api, oauth-service, oauth-api-serverless"`.

### Cross-service Connection event subscription — how to find it in Terraform
When scanning oauth-service (and similarly editor-service, vault), look for a
`queue_connection.tf` file (or similar) in the AWS Terraform module. This file contains:
- `aws_sqs_queue` resources for the subscriber-owned queues
- `aws_sns_topic_subscription` pointing to `var.connection_events_topic_arn` (and/or
  `var.connection_audit_log_topic_arn`)

The topic ARN variables come from Connection's Terraform outputs. The SQS queues are owned by
the subscriber service. This pattern is the same across all three subscriber services.

---

## omnisearch-and-metadata-engine

### Queue dependency — non-obvious URL derivation
`omnisearch-metastore-builder` calls `queue` via `QueueClient` in `metastore/impl.py`.
Queue URL derived at runtime: `re.sub(r"((?<=/)|^)connection\.", "queue.", url)`
This is invisible to ENV-only scanning.

Dependency: `omnisearch-metastore-builder` -> `queue` (reads job history per configuration).
`omnisearch-service-api` does NOT call queue — only the builder does.

---

## sandboxes-service (repos: keboola/sandboxes-service, keboola/keboola-as-code, keboola/keboola-operator, keboola/sandboxes)

### Two distinct products — do not confuse them

| Product | UI name | DNS | What manages it |
|---|---|---|---|
| Python/R sandboxes | Workspaces | `data-science.{suffix}` | sandboxes-service |
| Data Apps | Apps | `data-science.{suffix}` | sandboxes-service |

SQL Workspaces (SQL Editor) are managed exclusively by `editor-service`. Do NOT add SQL
Workspace functionality to the sandboxes container.

### sandboxes-api is removed — do not reference it

`keboola/sandboxes-api` (Node.js) no longer exists. The canonical API is `sandboxes-service`
(PHP/Symfony, repo `keboola/sandboxes-service`), served at `data-science.{suffix}`.

### Four repos, three distinct roles

| kbc-stacks app | Source | Language | Role |
|---|---|---|---|
| `sandboxes-service` | `keboola/sandboxes-service` | PHP | Central REST API; orchestrates provisioning |
| `apps-proxy` | `keboola/keboola-as-code` (`cmd/apps-proxy`) | Go | Reverse proxy for Apps only; NOT in keboola-operator repo |
| `keboola-operator` | `keboola/keboola-operator` | Go | K8s operator managing App/StorageToken/E2bSandbox CRDs |
| *(job component)* | `keboola/sandboxes` | PHP | Ephemeral job pod run via job-queue |

### apps-proxy is in keboola-as-code, not keboola-operator

`apps-proxy` lives at `keboola-as-code/cmd/apps-proxy` — the same monorepo as stream,
templates, and CLI. It is NOT part of `keboola-operator`. It is a standalone Deployment
in kbc-stacks (`apps/apps-proxy`).

apps-proxy has TWO K8s-related dependencies:
1. `sandboxes-service-api`: app configuration and auth (via `APPS_PROXY_SANDBOXES_API_URL`)
2. K8s API directly: watches App CRDs via `k8sapp.AppStateWatcher` (dynamic client)
   to determine which pods are running and route traffic to them

### Three provisioning paths for two products

| Product | Standard path | Secondary | Uncommissioned |
|---|---|---|---|
| Workspaces (Python/R) | `sandboxes` component via job-queue | operator (phasing in) | — |
| Apps | operator | `sandboxes` component (phasing out) | E2B |

### sandboxes component is a job-queue component, not a service

`keboola/sandboxes` (component ID: `keboola.sandboxes`) is not a persistent service.
It runs as ephemeral job pods via the standard job-queue runner infrastructure — spawned
by the daemon, exits on completion. It abuses the job-queue mechanism for async K8s
operations. It has its own `keboola/k8s-client` dependency for direct K8s API access.
Model as a `"Legacy"` component inside the `sandboxes` container.

### keboola-operator has no Terraform module

There is no `app-keboola-operator` Terraform module in the infrastructure repo.
All operator config (API token, KMS key, E2B API key, etc.) is injected entirely via
kbc-stacks `secret-config.yaml`. Do NOT look for Terraform infra_secrets for this service.

### keboola-operator runs in-cluster — K8s is its raison d'être

The operator uses `InClusterClientFacadeFactory` — it runs inside the K8s cluster.
Unlike sandboxes-service (which calls K8s from outside as an external client), the
operator IS part of the control plane. However, its K8s API usage IS still modelled as
a `-> aws-eks/azure-aks/gcp-gke` dependency because it is the operator's entire purpose
(managing App/StorageToken/E2bSandbox CRDs) — not the generic "runs-on" relationship.

### Job-runner KMS key — cross-service decrypt dependency

`sandboxes-service-api` uses `app.object_encryptor.job_queue` (the shared job-runner
KMS key) to **decrypt** app OAuth/config secrets that were **encrypted by the job-queue
component** using this shared key. This is a cross-service decrypt dependency — not
sandboxes-service doing its own encryption.

`keboola-operator` uses the same job-runner KMS key for the same reason: decrypting
app configuration secrets when provisioning app pods.

The service-owned KMS key (`kms-key-sandboxes-service-*`) is for sandboxes-service's
own internal encryption of app configuration (separate purpose from the job-runner key).

### Structurizr parent-child constraint

`apps-proxy` and `sandboxes-component` are components inside the `sandboxes` container.
Structurizr does NOT allow relationships between a component and its parent container.

Therefore:
- `apps-proxy -> sandboxes` is INVALID (parent-child)
- `apps-proxy -> sandboxes-service-api` is CORRECT (component-to-component)
- Same applies to `sandboxes-component -> sandboxes-service-api`

### C4 element IDs

Container: `sandboxes`
Components: `sandboxes-service-api`, `sandboxes-service-garbage-collector`,
  `sandboxes-service-messenger-consumer-connection-events`,
  `sandboxes-service-messenger-consumer-connection-audit-log`,
  `sandboxes-service-sync-app-runs-watch`, `sandboxes-service-suspend`,
  `sandboxes-service-purge-app-runs`, `sandboxes-service-prune-app-run-logs`,
  `apps-proxy`, `keboola-operator`, `sandboxes-component` (Legacy)
L3 files: `sandboxes-service.dsl`, `sandboxes-service-external.dsl`, `sandboxes-service.md`

---

## Architecture-wide conventions

These apply across all services. The skill files refer to this section instead of
restating these rules. The analyzer should always read this section in addition to
the per-service entry being scanned.

### Managed databases — collapsed across cloud providers

The MySQL and PostgreSQL instances (`mysql-instance-connection`, `mysql-instance-job-queue`,
`postgresql-instance`) are modelled as cloud-neutral elements without `AWS`/`Azure`/`GCP`
tags, even though each cloud stack hosts them on a different managed service: AWS RDS,
Azure Database for MySQL/PostgreSQL, or Cloud SQL on GCP. This is intentional. Applications
connect via cloud-agnostic `DB_*` environment variables (host, port, user, password,
database name); they do not see — and do not need to know — which managed service is
behind the connection string. Switching cloud requires only different connection-string
values, not application code changes.

All other cloud resource types are modelled per-cloud (separate `s3-*` / `abs-*` / `gcs-*`
elements for object storage, `kms-*` / `keyvault-*` for key management,
`sqs-*` / `servicebus-*` / `pubsub-*` for messaging, each tagged with its provider)
because applications interacting with those resources do see cloud-specific differences:
different SDK libraries, different authentication flows, different ENV variable shapes,
and often different operational characteristics. The DB collapse only works because the
cloud-specific surface area is fully hidden behind a connection string.

When adding a new resource type to `cloud-resources.dsl`, the question to ask is: "Does
the application code differ across clouds when consuming this resource?" If yes, model
per-cloud with provider tags. If no (DB-style abstraction), collapse to one element.

### Application-managed encryption — never modelled as cloud resource

Some services use locally-managed symmetric keys (AES, etc.) stored as Kubernetes Secrets
to encrypt data before persisting. Examples:

- `kai-app-ai-chat`'s `TOKEN_ENCRYPTION_KEY` (32-byte AES-GCM, encrypts OAuth tokens before PostgreSQL)
- `query-service`'s `QUERY_ENCRYPTION_AES_SECRET_KEY` (32-byte AES-256, encrypts workspace credentials)
- Connection's `ENCRYPTION_KEYS__*` (Connection's own symmetric encryption infrastructure)

These are NOT cloud KMS / Key Vault / Cloud KMS. The keys are random values stored as
Kubernetes Secret resources with no involvement of any cloud provider's key-management
service. Do NOT add `kms-key-*` or `keyvault-*` relationships for them. They are
intentionally not modelled as cloud resources at all — the encryption is a service
implementation detail invisible to other services.

The only cloud KMS/Key Vault relationships modelled are those where the application
explicitly calls a cloud KMS API at the application level — typically via
`Keboola\ObjectEncryptor` or equivalents. Encryption-at-rest of databases or buckets
(where the cloud provider transparently encrypts using a key the application never sees)
is also NOT modelled — see "KMS / Key Vault — shared key vs service-owned keys" below.

### Observability tooling — modelled at L1 platform level only, never per-component

Datadog and LangSmith are observability platforms used across the Keboola platform. They
are modelled as `Vendor`-tagged softwareSystems in `external-systems.dsl` with a single
platform-level relationship (`keboolaPlatform -> datadog`, `keboolaPlatform -> langsmith`)
that appears only on the L1 System Context view. They are NEVER modelled as per-service
or per-component dependencies, even though most services emit telemetry to them.

Signals to skip when scanning at component level:
- All `DD_*` ENV keys (Datadog APM, logging, profiling) — appear in nearly every service's
  infra_secrets and Helm secret templates
- `LANGSMITH_API_KEY` / `LANGCHAIN_API_KEY` — currently only in the KAI apps (ai-chat,
  kai-assistant, kai-agent), but treated identically

Rationale: cross-cutting observability platforms are an architectural backdrop, not a
service-level dependency. Showing them per-component would clutter every L3 diagram with
the same edge. The L1 platform-level relationship captures the dependency once at the
right level of abstraction.

### Two distinct "job" concepts — do not confuse them

Storage jobs (`Storage_Service_Jobs` in Connection): internal platform operations. NOT related to Queue.
Component jobs (`Keboola\JobQueueClient\Client`): user pipeline runs owned by Queue service.

### Two distinct "workspace" concepts — do not confuse them

Connection workspaces: low-level DB schema in customer Snowflake/BigQuery. Managed by Connection.
User-facing workspaces (SQL Editor sessions, Sandboxes, Data Apps): managed by Sandboxes or Editor.
Both Editor and Sandboxes call Connection's workspace API for Snowflake/BigQuery backend provisioning.

### KMS / Key Vault — shared key vs service-owned keys

Shared job-runner key (`kms-key-job-runner-aws/azure/gcp`): signal is `var.job_runner_kms_key_id`.
Service-owned keys: signal is a locally-created resource (e.g. `aws_kms_key.{service}.id`).
KMS relationships are added only for application-level encryption, NOT DB encryption-at-rest.

### Service-owned object storage vs shared buckets

Only shared bucket is `s3-bucket-logs` (CFn: `kbc-logs-bucket`). All other buckets are service-owned.
Signal: bucket variable references a locally-created resource, not a shared bucket variable.

### Cross-service fan-out pattern — topic owner vs queue owner

- **Connection** owns the SNS/EventGrid/Pub/Sub **topics** (`app-connection` Terraform module).
  Topic ARNs are passed as output variables to subscriber modules.
- **Subscriber services** (editor, vault, oauth, sandboxes-service) own their **subscription queues**,
  provisioned in their own Terraform modules (typically `queue_connection.tf`), creating
  `aws_sns_topic_subscription` pointing at `var.connection_events_topic_arn`.

When scanning a subscriber, `var.connection_events_topic_arn` = subscribing to Connection's
cross-service topic. Subscriber-owned queue (e.g. `sqs-queue-editor-service-connection-events`) is the
C4 named resource. The Connection topic (`sns-topic-connection-events`) is already modelled.

### Vendor-tagged elements and the L1 system context view

Elements tagged `"Vendor"` (GitHub, SendGrid, Stripe, E2B, azure-marketplace, google-marketplace)
represent third-party external SaaS services that are platform-level dependencies. They appear
on the **L1 system context view** but are excluded from the L2 container view via
`exclude "element.tag==Vendor"`. L3 component views that need to show Vendor elements must
include them explicitly (e.g. `include github`, `include e2b`).

**E2B** is the only Vendor-tagged element that originates from a component-level dependency
(`kai-app-kai-agent` and `keboola-operator`) rather than a container-level one. It is explicitly
included in both the L1 view and the relevant L3 views.

**Google Vertex AI and Azure AI Foundry** are tagged `"CloudResource"`, not `"Vendor"`, because
they are specific managed AI platform deployments within a cloud provider, not independent SaaS.

### Elasticsearch — two separate instances

Two independent Elasticsearch clusters are deployed via the single `apps/elasticsearch` Helm chart
using an `elasticsearchInstances` values map:

- `connection-elasticsearch` (namespace `connection-elasticsearch`): used by Connection for event
  search, global search index, and audit log indexing. Currently on ES 9.x with upgrade tooling
  (`remoteWhitelist`, `reindexRemoteCaCertSecret`) for zero-downtime version migration.
- `job-queue-elasticsearch` (namespace `default`): used by Queue for job indexing and search.
  Separate version, separate ECK configuration, separate infra secrets, snapshot-enabled.

Both are modelled as standalone **containers** at L2 (not components), because they are
independently deployed and shared across multiple components that are not co-located.
etcd instances (`stream-etcd`, `templates-api-etcd`) are modelled as **components** because they
are co-deployed as Bitnami Helm sub-charts within their parent service's Helm release and cannot
be deployed independently.

### Kubernetes clusters — modelled only for explicit application-level K8s API usage

`aws-eks`, `azure-aks`, `gcp-gke` are defined in `external-systems.dsl` with tag
`"CloudResource"`. They are NOT tagged `"CloudProvider"` or `"Vendor"`, because either
of those tags would exclude them from L3 component views (which is precisely where
they need to appear).

**The implicit "runs on K8s" relationship is never modelled.** Every container in the
platform runs on a managed K8s cluster, but this is not captured anywhere in the model
— not at L1 (where `keboolaPlatform -> aws/azure/gcp` covers it transitively), not at
L2, and not at L3. Modelling "runs on K8s" per-component would add the same edge to
every diagram with no corresponding informational gain.

**A `<component> -> aws-eks/azure-aks/gcp-gke` relationship is added only when the
component calls the Kubernetes API at the application level** — meaning the K8s API is
part of the component's actual work, not just its hosting environment. Concrete signals:

- Spawning pods (e.g. job-queue-daemon spawning per-job runner pods)
- Managing custom resources / CRDs (e.g. keboola-operator reconciling App CRDs)
- Watching resources to drive runtime behaviour (e.g. apps-proxy watching App CRDs to route traffic)
- Direct pod / service / PVC manipulation (e.g. sandboxes-component creating sandbox pods)

Decision heuristic: would this component still need to function if you replaced K8s with
a different orchestrator? If yes, no K8s relationship. If no (it's intrinsic to what the
component does), add the relationship. `keboola-operator` runs in-cluster and might be
tempting to treat as "just running on" K8s, but managing CRDs IS its purpose — so it
gets the relationship.

The model is the source of truth for which components are currently modelled this way —
grep `aws-eks` / `azure-aks` / `gcp-gke` across `l3/*-external.dsl` to enumerate them. Do
not maintain a list of these components in this file; it would inevitably drift from the
model. When adding a new K8s relationship, also add a per-service note documenting the
specific K8s usage pattern (the model edge description alone is too terse to convey
*why* the component does this).

---

## Template for new entries

## <repository-name>

### <rule category>
Description of non-obvious rules for scanning this service.
