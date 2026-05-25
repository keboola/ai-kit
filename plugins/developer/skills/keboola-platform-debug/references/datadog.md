# Datadog reference for Keboola platform debugging

Single source of truth for environment tags, service names, log/APM attributes, and query templates used when debugging Keboola platform incidents through the `datadog-mcp` server.

## Region

Datadog **EU site**.
- UI: `https://app.datadoghq.eu`
- API host: `api.datadoghq.eu`

## Log retention

| Telemetry | Retention | Implication |
|---|---|---|
| Logs | **7 days** | For incidents older than 7 days, logs are gone — use APM traces. |
| APM traces | 1-2 months | Survives well past log expiry, slower to query. |
| Online archives / flex tier | months+ | Use `storage_tier: "online_archives_and_indexes"` parameter on `search_datadog_logs`. |

Always check incident age first. If older than ~5 days, **start with APM** (`search_datadog_spans`), not logs.

## Stack ↔ `env` tag mapping

The Keboola directory name (in `kbc-stacks` repo) is NOT the same as the Datadog `env` tag. Always look up before scoping queries.

| Keboola stack directory | Connection hostname | Datadog `env` |
|---|---|---|
| `kbc-us-east-1` | `connection.keboola.com` | `kbc-us-east-1` |
| `kbc-eu-central-1` | `connection.eu-central-1.keboola.com` | `kbc-eu-central-1` |
| `com-keboola-azure-north-europe` | `connection.north-europe.azure.keboola.com` | `com-keboola-azure-north-europe` |
| `com-keboola-gcp-europe-west3` | `connection.europe-west3.gcp.keboola.com` | `com-keboola-gcp-europe-west3` |
| `com-keboola-gcp-us-east4` | `connection.us-east4.gcp.keboola.com` | `com-keboola-gcp-us-east4` |
| `dev-keboola-aws-eu-west-1` | `connection.aws-eu-west-1.dev.keboola.com` | `dev-keboola-aws-eu-west-1` |
| `dev-keboola-gcp-us-central1` | `connection.us-central1.gcp.keboola.dev` | `dev-keboola-gcp-us-central1` |
| `kbc-testing-azure-east-us-2` | `connection.east-us-2.azure.keboola-testing.com` | `kbc-testing-azure-east-us-2` |
| `cloud-<customer>-<region>` | customer ST hostname | `cloud-<customer>-<region>` |

To verify a stack's `env` tag if unknown:
```
"<jobId>"  OR  "<projectId>" AND status:error
```
Run unfiltered first, inspect the `env:` field, then re-scope.

## Datadog `service` catalog (full Keboola platform)

Group these by L2 container from C4 model (see `developer:keboola-architecture` skill for inter-service edges).

### Connection
| Service | Role |
|---|---|
| `connection` | Storage / Manage / PAYG API (Nginx + PHP-FPM) |
| `connection-worker-main` | Main Symfony Messenger storage queue worker (storage jobs) |
| `connection-worker-email` | Email sender; alert on `failed_emails` queue depth |
| `storage-queue-receive-main` | Storage jobs queue |
| `storage-queue-receive-eventsElastic` | Replicates events into Elasticsearch |
| `storage-queue-receive-commands` | Async commands (e.g. project purge) |
| `storage-queue-receive-tableTriggers` | Table-driven triggers |
| `storage-queue-receive-auditLog` | Audit log persistence |
| `storage-token-expirator` | Cron: expires storage/manage tokens |
| `messenger-consume-searchIndex` | Search index sync |
| `messenger-consume-scheduler` | Scheduler events |
| `oauth-clear-expired-tokens` | OAuth token GC |
| `connection-cronjob-release-staled-locks` | K8s pod scan to release stale worker locks |

### Job queue
| Service | Role |
|---|---|
| `job-queue` / `job-queue-public-api` | External API (port 8081) |
| `job-queue-internal-api` | Core: MySQL + Elasticsearch (port 8080), state machine |
| `job-queue-runner` / `job-queue-service-container` | Ephemeral per-job pods (`pod_name:job-<id>`) |
| `job-queue-logs-handler` | GELF log socket sidecar inside job pods |
| `job-queue-daemon-run` | Dispatches waiting jobs → publishes to `jobs-to-start` SQS/ServiceBus/PubSub |
| `job-queue-daemon-start` | Consumes `jobs-to-start` → creates K8s pod |
| `job-queue-daemon-stop` | Reconciles running jobs; finalizes job state on completion / pod loss |
| `job-queue-daemon-flow-jobs-transition` | Consumes `flow-jobs-transition` → flow state machine |
| `daemon-cron-pod-cleanup` | Cron (10m): cleans up orphaned K8s pods |
| `daemon-cron-db-cleanup` | Cron (1h): purges stale DB records |
| `daemon-cron-flow-cleanup` | Cron (30m): purges stale flow job data |

### Sandboxes / Apps
| Service | Role |
|---|---|
| `sandboxes-service-api` | Sandboxes control plane (Symfony, RoadRunner) |
| `sandboxes-service-garbage-collector` | Reaps orphan PVCs, namespaces |
| `sandboxes-service-messenger-consumer-connection-events` | Consumes connection events |
| `apps-proxy` | Reverse proxy for Apps (watches App CRDs via K8s) |
| `keboola-operator` | K8s operator reconciling `App` / `StorageToken` / `E2bSandbox` CRDs |

### Stream
| Service | Role |
|---|---|
| `stream-api` | Stream ingestion API |
| `stream-http-source` | HTTP source |
| `stream-storage-coordinator` | Storage uploads coordinator |
| `stream-storage-reader` | Reads slices from local disk for upload |
| `stream-storage-writer` | Writes slices to local disk |
| `stream-etcd` | etcd backing store (StatefulSet) |

### Editor
| Service | Role |
|---|---|
| `editor-api` | Code editor API |
| `editor-consumer` | Workspace event consumer |
| `editor-session-worker` | Per-session worker (lives as long as the user) |

### Other platform services
| Service | Role |
|---|---|
| `vault` | Secrets vault (per-project variables) |
| `encryption` / `encryption-api` | Encryption API (cipher only — not job-runner KMS) |
| `oauth` / `oauth-api` | OAuth tokens for components |
| `scheduler` | Scheduled / triggered orchestrations |
| `notification` | User notifications (Slack, email, webhook) |
| `billing` | Usage metering, invoicing |
| `ai` | AI / LLM / embeddings backend (not Kai) |
| `templates-api` | Template-driven config generator |
| `metastore-api` | Metadata store |
| `omnisearch-metastore-builder` | Search index builder |
| `data-science-api` | Data science workspaces |
| `sync-actions` | Sync component actions (test connection, list tables) |

### AI / Kai
| Service | Role |
|---|---|
| `kai-assistant` | Kai backend; LLM errors, compaction, stack traces |
| `kai-agent` | Kai agent (E2B-backed code execution) |
| `mcp-server` | Generic MCP server |
| `mcp-server-agent` | Agent-mode MCP server; tool calls keyed by `mcpServerContext.conversationId` |

## Tag conventions

### Standard log tags
| Tag | Example | Notes |
|---|---|---|
| `env` | `kbc-eu-central-1` | Always scope queries by this |
| `service` | `job-queue-service-container` | Or wildcard: `service:job-queue-*` |
| `version` | `production-<full-sha>` | Useful for "did this deploy break it?" |
| `host` | `i-0aef3fdf99afe9a8e` | EC2 instance ID (AWS), node name elsewhere |
| `status` | `info` / `error` / `critical` / `emergency` | Severity |

### Keboola-specific tags (lowercase, no `@`)
| Tag | Where it appears | Example |
|---|---|---|
| `componentid` | All job-pod logs | `componentid:keboola.ex-db-pgsql` |
| `configid` | All job-pod logs | `configid:ai-chat-service` |
| `projectid` | All job-pod logs, many service logs | `projectid:2974` |
| `pod_name` | All K8s logs | `pod_name:job-993111302` (job ID is here, not a separate tag) |
| `kube_namespace` | All K8s logs | `default`, `job-queue-jobs`, `keboola`, etc. |
| `kube_app_instance` | Job pods | `kube_app_instance:993111302` (numeric job id) |
| `kube_node` | All K8s logs | `kube_node:ip-10-10-32-227.eu-central-1.compute.internal` |
| `keboolastack` | Most pods | `keboolastack:kbc-eu-central-1` (alternative to `env`) |
| `nodepool` | All K8s logs | `nodepool:job-queue-jobs-alternat-b-short-run-time` |
| `cluster_name` | All K8s logs | `cluster_name:kbc-eu-central-1` |

### Log attributes (prefix with `@`, derived from JSON payload)
| Attribute | Where | Example |
|---|---|---|
| `@runId` | Component job logs (legacy term for jobId) | `@runId:993111302` |
| `@error.message` | All structured error logs | for clustering / filtering |
| `@error.stack` | All structured error logs | full stack trace |
| `@http.status_code` | HTTP services | `@http.status_code:[500 TO 599]` |
| `@duration` | APM-instrumented services | `@duration:>1000` (ms) |
| `@projectId` | Some PHP services | (camelCase variant of tag) |
| `@componentId` | Some PHP services | |
| `@configId` | Some PHP services | |

### APM span attributes
| Attribute | Service | Use case |
|---|---|---|
| `job.jobId` | `job-queue-runner` | Component job tracing |
| `context.jobId` | `connection-worker-main` | Storage job tracing |
| `@conversation.id` | `kai-*`, `mcp-server-agent` | Kai conversation tracing |
| `resource_name` | Any | Operation name |
| `trace_id`, `span_id` | All | Correlate across services |

## Query templates

### Find everything about a single job
```
env:<env> "<jobId>"                              # broad, gets daemon + pod + API logs
env:<env> pod_name:job-<jobId>                   # only the pod itself
env:<env> kube_app_instance:<jobId>              # K8s-tagged pod logs (more reliable than pod_name)
service:job-queue-runner @job.jobId:<jobId>      # APM (works for old jobs >7d)
```

### Errors in a component for a project
```
env:<env> componentid:keboola.<component> projectid:<id> status:(error OR critical)
```

### Pattern discovery (cluster similar errors)
```
search_datadog_logs(
  query: "env:<env> service:<svc> status:error",
  use_log_patterns: true,
  clustering_pattern_field: "@error.message",
  pattern_group_by: ["service"]
)
```

### Aggregation (DDSQL via analyze_datadog_logs)
Always declare non-standard columns in `extra_columns` — the only "free" columns are `timestamp`, `host`, `service`, `env`, `version`, `status`, `message`.

```sql
-- Hourly error rate by service
SELECT DATE_TRUNC('hour', timestamp) AS bucket, service, COUNT(*) AS errors
FROM logs
WHERE status = 'error'
GROUP BY DATE_TRUNC('hour', timestamp), service
ORDER BY DATE_TRUNC('hour', timestamp) DESC
```

```sql
-- Top error patterns from a service
-- extra_columns: ['@error.message']
SELECT "@error.message", COUNT(*) AS cnt
FROM logs
WHERE status = 'error'
GROUP BY "@error.message"
ORDER BY cnt DESC
LIMIT 20
```

**DDSQL gotchas**
- `ORDER BY <alias>` may fail — repeat the expression: `ORDER BY DATE_TRUNC('hour', timestamp) DESC`.
- `TIMESTAMP_BUCKET` is not accepted — use `DATE_TRUNC('hour'|'day'|...)`.
- Never use `tags->key` syntax — declare the tag in `extra_columns` and reference by bare name.
- Always quote `@`-prefixed columns: `"@error.message"`.

### Pre-warm cache via patterns when log count is high
If a broad search would return 1000+ rows, use `use_log_patterns: true` first to see the shape, then drill in with `start_at` pagination on the largest pattern.

## Trace correlation across services

Every Keboola PHP service propagates the Datadog `trace_id` via HTTP headers (`x-datadog-trace-id`, `x-datadog-parent-id`). For a single job:
1. Find the originating request (e.g. component error in `service:job-queue-service-container`).
2. Note `trace_id`.
3. Search across all services with the same trace: `trace_id:<id>` (no `env` needed, trace IDs are unique).
4. Order results by `timestamp` to reconstruct flow.

For async hops (SQS / ServiceBus / PubSub), trace context **is** propagated through message attributes for most services. Verify by searching the queue name (`sqs-queue-*`) — if hops are absent, check different `trace_id` and link by `jobId` / `conversationId` / timestamp.

## Cross-tool joins (not Datadog, but adjacent)

| From | To | Joining key |
|---|---|---|
| Datadog APM | Sentry (kbc-ui) | timestamp + projectId + userAgent |
| Datadog APM | Sentry (connection backend) | exception fingerprint + timestamp |
| Datadog APM | LangSmith (Kai) | `conversation.id` / `thread_id` + timestamp (**OTEL trace ID does NOT propagate**) |
| Datadog logs | K8s events | `kube_namespace` + `pod_name` + timestamp via `kubectl get events` |
| Datadog logs | Snowflake query history | Telemetry Project 133 — see `service-catalog.md` |

## Telemetry project 133 — for cross-stack analytical questions

When Datadog can't answer (e.g. "which customers ran most Snowflake credits last week?", "MCP tool call distribution"), the centralized Telemetry project lives at:
- **Stack**: `connection.us-east4.gcp.keboola.com`
- **Project id**: `133`
- **Dialect**: Snowflake
- **MCP**: `keboola-mcp-us-east4gcp` / `mcp__claude_ai_Keboola_MCP_AWS_US__*`
- **Contents**: Snowflake sessions/queries, component usage, config metadata, MCP analytics, PAYG A/B tests, MFA/token audits, healthcheck data for storage jobs.

## Skill Mode

When `datadog/<domain>` skills exist (e.g. `datadog/logs`, `datadog/traces`, `datadog/visualizations`), load them at the start of work in that domain. Use `list_datadog_skills` + `load_datadog_skill`.
