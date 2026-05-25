# Per-service debugging catalog

For each Keboola platform service: Datadog handle, common failure modes, query templates, and C4 path for impact analysis. Use as a lookup index — start with the service identified during Phase 1.

For inter-service edges and cloud dependencies, defer to the `developer:keboola-architecture` skill — paths listed below are `c4/l3/<file>` inside that skill's `references/` directory.

## Table of contents
- [Connection (Storage / Manage / PAYG)](#connection)
- [Job queue (public + internal API, runner)](#job-queue)
- [Job queue daemon](#job-queue-daemon)
- [Sandboxes / Apps / Operator](#sandboxes-apps-operator)
- [Stream](#stream)
- [Editor](#editor)
- [Vault](#vault)
- [Encryption API](#encryption-api)
- [OAuth API](#oauth-api)
- [Scheduler](#scheduler)
- [Notification](#notification)
- [Billing](#billing)
- [AI / Kai / MCP](#ai-kai-mcp)
- [Templates / Metastore / Sync Actions](#templates-metastore-sync-actions)

---

## Connection

**Repo**: `keboola/connection`
**C4**: `connection.dsl`, `connection.md`, `connection-external.dsl`
**Datadog services**: `connection` (API), plus per-worker services listed in `datadog.md`.
**Persistence**: MySQL (`mysql-instance-connection`), Elasticsearch (events), Redis (cache), S3/GCS/Azure Blob (file uploads).

### Common failure modes
| Symptom | Where to look | Tip |
|---|---|---|
| 5xx from `connection` API | `service:connection env:<env> status:error` | Check `version` for recent deploy. Verify via `curl /v2/storage \| jq .revision`. |
| Storage job stuck in "waiting" | `service:connection-worker-main` | Check supervisord status, `keboola.connection.jobsWorkersCount` metric. Inspect `failed_emails` if it's a notification job. |
| Storage API timeout from client | APM `service:connection` slow spans | Aggregate by `resource_name`, check backend (Snowflake/BQ) health via `bin/console storage:backend:health-check`. |
| Event search lagging | `service:storage-queue-receive-eventsElastic` | Check Elasticsearch indexing lag, run `queue-replication-check`. |
| Token expired unexpectedly | `service:storage-token-expirator` | Inspect expirator cron logs; tokens auto-expire by policy. |
| Audit log gaps | `service:storage-queue-receive-auditLog` | Check queue depth; messages may be in DLQ. |
| Worker pod scheduling issues | `service:connection-cronjob-release-staled-locks` | This cron releases locks held by terminated workers; if it stops, locks accumulate. |

### Deploy verification
```bash
# Match commit SHA after merge
curl -s https://connection.<host>/v2/storage | jq -r .revision
# Or via Datadog APM rollout state:
aggregate_events(query="service:connection env:<env>", group_by=["version"])
# Two versions = mid-deploy (~5min). One version + correct SHA = done.
```

### Subsystems
- **Storage API** — table/bucket/file operations
- **Manage API** — projects, users, tokens, organizations
- **PAYG API** — pay-as-you-go billing flows
- **Events API** — audit + analytics events (Elasticsearch-backed)
- **Workers** — Symfony Messenger + supervisord; per-queue worker services

### Cross-reference
- Job state changes go through `connection-worker-main` (storage jobs) or `job-queue` (component jobs).
- OAuth API and Sandboxes API ultimately call back into Storage API for token verification.

---

## Job queue

**Repo**: `keboola/job-queue` (monorepo with public-api, internal-api, runner sub-apps)
**C4**: `job-queue.dsl`, `job-queue.md`
**Datadog services**: `job-queue` (public API), `job-queue-internal-api`, `job-queue-runner` / `job-queue-service-container`
**Persistence**: MySQL (`mysql-instance-job-queue`), Elasticsearch (job search/replication)
**Queue dependencies**: see `job-queue-daemon` below

### Common failure modes
| Symptom | Where to look | Tip |
|---|---|---|
| Job "Internal Error" status | See `internal-error.md` decision tree | Always start there. |
| `Invalid status transition` 400 | `service:job-queue-internal-api status:error` | State machine rejecting transitions; usually a downstream symptom of daemon race (B). |
| Job stuck in "waiting" | `service:job-queue-daemon-run` | Daemon may not be picking up. Check `Dispatching waiting job <id>` log. |
| Storage usage missing | `service:job-queue-internal-api "metrics"` | Internal-api computes usage; logstash replication lag affects search. |
| Replication check failures | `service:queue-replication-check` (cron 15min) | MySQL → Elasticsearch lag; usually self-recovers. |

### Job state machine (internal-api)
States: `created → waiting → processing → success | error | warning | terminated | cancelled`
Plus desired states: `processing | terminated | cancelled`
`StateTerminalException` (HTTP 400) is thrown for any transition from a terminal state (`success/error/...`) back to a non-terminal state.

### Source file references
- State machine: `apps/internal-api/src/Controller/Job/UpdateJobAction.php:50`
- Internal client: `apps/service-container/vendor/keboola/job-queue-internal-api-php-client/src/Client.php`

---

## Job queue daemon

**Repo**: `keboola/job-queue-daemon` (separate from job-queue)
**C4**: `job-queue-daemon.dsl`, `job-queue-daemon.md`, `job-queue-daemon-external.dsl`
**Datadog services** (4 deployments + 3 cronjobs):
- `job-queue-daemon-run` — `app:run`, dispatches waiting jobs (publishes to `jobs-to-start`)
- `job-queue-daemon-start` — `messenger:consume jobsToStart`, creates K8s pods
- `job-queue-daemon-stop` — `app:stop`, reconciles running jobs, finalizes state
- `job-queue-daemon-flow-jobs-transition` — `messenger:consume flowJobsTransition`
- `daemon-cron-pod-cleanup` (10min) — K8s orphan pod cleanup
- `daemon-cron-db-cleanup` (1h) — stale DB records
- `daemon-cron-flow-cleanup` (30min) — stale flow data

### Pattern A queue topology
Daemon-owned queues (on AWS/Azure/GCP variant):
- `sqs-queue-daemon-jobs-to-start` / `servicebus-queue-daemon-jobs-to-start` / `pubsub-topic-daemon-jobs-to-start` — published by daemon-run, consumed by daemon-start
- `sqs-queue-daemon-flow-jobs-transition` / etc. — published by daemon-run, consumed by daemon-flow-jobs-transition

### Common failure modes
| Symptom | Where to look | Tip |
|---|---|---|
| Duplicate dispatch / "missing its task" | See `internal-error.md` cause B | Most common opaque daemon failure |
| Jobs stuck in waiting | `daemon-run "Dispatching waiting job"` | Should appear within seconds of job creation; if absent, daemon may be wedged |
| Pod creation failures | `daemon-start "Failed to start"` | Check K8s manifest, ECR auth, ResourceQuota |
| Stop daemon not finalizing | `daemon-stop "K8s Pod ... is missing"` | Pod may have been deleted out-of-band; pod-cleanup cron also runs |
| Orphan pods accumulating | `daemon-cron-pod-cleanup` | Cron should run every 10min; check its last run |
| Excessive duplicate dispatches | analyze on `daemon-stop "Dispatching waiting job"` | Healthy stack: ~100-1000/h. Pathologically high → investigate SQS visibility timeout |

### K8s pod naming
Deterministic: `job-<jobId>` (e.g. `job-993111302`).
Namespace: `job-queue-jobs` (per stack convention).
Image: `keboola.job-queue-service-container` from ECR.

---

## Sandboxes / Apps / Operator

**Repos**: `keboola/sandboxes-service`, `keboola/keboola-operator`, `keboola/sandboxes` (job component)
**C4**: `sandboxes.dsl`, `sandboxes.md`
**Datadog services**: `sandboxes-service-api`, `sandboxes-service-garbage-collector`, `sandboxes-service-messenger-consumer-connection-events`, `apps-proxy`, `keboola-operator`

### Two provisioning strategies
| Strategy | Trigger | State source of truth |
|---|---|---|
| **JOB_QUEUE (legacy)** | Job-queue lifecycle | DB locks in MySQL; `AppLifecycleManager` |
| **OPERATOR (modern)** | K8s CRDs `apps.keboola.com/v1` (`App`, `AppRun`) | CRD `.status` fields |

### Common failure modes
| Symptom | Strategy | Where to look |
|---|---|---|
| Sandbox stuck in "creating" | JOB_QUEUE | `service:sandboxes-service-api "stuck"` + DB lock query |
| App pod not appearing | OPERATOR | `kubectl get apps.apps.keboola.com -n <ns>` → check `.status.conditions`; `service:keboola-operator status:error` |
| Apps-proxy 502 / 504 | OPERATOR | `service:apps-proxy "no upstream"`; verify CRD `.status.ready=true` |
| Orphan PVCs | Either | `service:sandboxes-service-garbage-collector` log; manual `GarbageCollectCommand` if needed |
| KMS decrypt failures | Either | Sandboxes-service decrypts app secrets via shared **job-runner KMS key** (not its own). Check IAM. |
| E2B sandbox not starting | OPERATOR (E2B path) | `service:keboola-operator "E2bSandbox"`; verify E2B team config |

### CRD inspection
```bash
kubectl --context <ctx> -n <project-ns> get apps.apps.keboola.com -o yaml
kubectl --context <ctx> -n <project-ns> describe app <name>
# AppRun for runtime status:
kubectl --context <ctx> -n <project-ns> get appruns.apps.keboola.com
```

---

## Stream

**Repo**: `keboola/stream` (part of `keboola-as-code` monorepo)
**C4**: `stream.dsl`, `stream.md`
**Datadog services**: `stream-api`, `stream-http-source`, `stream-storage-coordinator`, `stream-storage-reader`, `stream-storage-writer`, `stream-etcd`

### Common failure modes
| Symptom | Where to look |
|---|---|
| Records lost / ingestion 5xx | `service:stream-http-source status:error` + check etcd health |
| Slices stuck on disk | `service:stream-storage-coordinator "upload"` |
| etcd CrashLoopBackOff | Use `etcd-restore` skill (`stream-etcd` StatefulSet) |
| Storage upload to Snowflake failing | `service:stream-storage-coordinator "Snowflake"` |

### etcd specifically
StatefulSet `stream-etcd` in stack namespace. Common issues require the dedicated **`etcd-restore` skill** — bootstrap failures, lost quorum, phantom members, `gke-gcsfuse-sidecar` init stuck.

---

## Editor

**Repo**: `keboola/editor`
**C4**: `editor.dsl`, `editor.md`
**Datadog services**: `editor-api`, `editor-consumer`, `editor-session-worker`

### Common failure modes
| Symptom | Where to look |
|---|---|
| Editor session not opening | `service:editor-session-worker projectid:<id>` |
| File save 5xx | `service:editor-api status:error` |
| Workspace events not consumed | `service:editor-consumer "lag"` |

---

## Vault

**Repo**: `keboola/vault`
**C4**: `vault.dsl`, `vault.md`
**Datadog services**: `vault`
**Persistence**: MySQL (`mysql-instance-job-queue` — shared!)

### Common failure modes
| Symptom | Where to look | Tip |
|---|---|---|
| Variable not resolved in job | `service:vault projectid:<id>` | Check `vault.variable.not_found` errors |
| 401 from job-pod to vault | `service:vault status:error` "token" | StorageApi token chain to vault |
| Pod identity issues (Azure) | Check AAD pod identity assignment | Vault uses Azure-specific auth pattern on Azure stacks |

---

## Encryption API

**Repo**: `keboola/encryption-api`
**C4**: `encryption.dsl`, `encryption.md`
**Datadog services**: `encryption` / `encryption-api`
**Cloud keys**: `kms-key-encryption-aws`, `kms-key-encryption-azure`, `kms-key-encryption-gcp` (separate from job-runner KMS!)

### Common failure modes
| Symptom | Where to look | Tip |
|---|---|---|
| `KBC::ProjectSecure::` decrypt fails | `service:encryption status:error "decrypt"` | Usually wrong project, wrong stack, or KMS IAM |
| Slow API responses | APM `service:encryption` | Inspect KMS latency spans |
| Mixed cloud encryption | check `version` tag for recent deploys | Cross-cloud secret transport happens via shared formats |

### Note
**Job-runner secrets** use a DIFFERENT KMS key (`kms-key-job-runner-*`, shared with `queue-runner`, `job-queue-daemon`, `sync-actions`). Encryption API is for storage-level secrets.

---

## OAuth API

**Repo**: `keboola/oauth-api-v3`
**C4**: `oauth.dsl`, `oauth.md`
**Datadog services**: `oauth` / `oauth-api`
**Cron**: `oauth-clear-expired-tokens` (token GC)

### Common failure modes
| Symptom | Where to look |
|---|---|
| OAuth flow stuck | `service:oauth componentid:<id>` |
| Token decrypt fails | Cross-check with `encryption` (shared cipher chain) |
| Expired token still cached | Check `oauth-clear-expired-tokens` cron last run |

---

## Scheduler

**Repo**: `keboola/scheduler`
**C4**: `scheduler.dsl`, `scheduler.md`
**Datadog services**: `scheduler`

### Common failure modes
| Symptom | Where to look |
|---|---|
| Schedule didn't fire | `service:scheduler projectid:<id> status:error` |
| Scheduled job failed | Follow `runId` into `job-queue` logs |
| Scheduler missing latest changes | Check `messenger-consume-scheduler` worker on connection side |

---

## Notification

**Repo**: `keboola/notification`
**C4**: `notification.dsl`, `notification.md`
**Datadog services**: `notification`

### Common failure modes
| Symptom | Where to look |
|---|---|
| Slack notification missing | `service:notification status:error "slack"` |
| Email not sent | Also check `connection-worker-email` + `failed_emails` queue depth |
| Webhook 5xx | `service:notification "webhook" status:error` |

---

## Billing

**Repo**: `keboola/billing`
**C4**: `billing.dsl`, `billing.md`
**Datadog services**: `billing`

### Common failure modes
| Symptom | Where to look |
|---|---|
| Usage metering missing | `service:billing status:error projectid:<id>` |
| Stripe webhook failures | `service:billing "stripe"` |
| PAYG limit not enforced | `service:billing "limit"` + cross-check connection PAYG API |

---

## AI / Kai / MCP

**Repos**: `keboola/kai-assistant`, `keboola/kai-agent`, `keboola/mcp-server`
**C4**: `ai.dsl`, `kai.dsl`, `mcp-server.dsl`
**Datadog services**: `kai-assistant`, `kai-agent`, `mcp-server`, `mcp-server-agent`, `ai` (lower-level LLM/embeddings backend)

### Where to look
| For | Where |
|---|---|
| LLM call errors, prompts, conversations | **LangSmith** (project `kai-assistant`, EU region `https://eu.api.smith.langchain.com`) |
| Backend errors, stack traces, compaction | `service:kai-assistant` in Datadog |
| MCP tool calls | `service:mcp-server-agent` filter by `@mcpServerContext.conversationId` |
| E2B sandbox metrics | `e2b-monitor` skill |
| Cross-correlation | Join LangSmith ↔ Datadog by `conversation.id` / `thread_id` + timestamp — **OTEL trace ID does NOT propagate** |

### Common failure modes
| Symptom | Where to look | Tip |
|---|---|---|
| "Prompt too long" error | LangSmith fetch_runs with `error:true` | Vertex AI returns HTTP 400; usually triggers Kai compaction |
| Tool call timeout | `service:mcp-server-agent` | Check tool name, conversation flow |
| Rate limiting 429 | `service:kai-assistant "429"` | LangSmith on `POST /runs/query` |
| Sandbox start failure | `service:kai-agent "e2b"` | Verify E2B team config, secrets in stack `secrets.yaml` |

---

## Templates / Metastore / Sync Actions

| Service | Datadog handle | Common failures |
|---|---|---|
| Templates | `templates-api` | Template generation errors; check `templates-api-etcd` health |
| Metastore | `metastore-api` | Metadata write failures; cross-check `omnisearch-metastore-builder` |
| Sync Actions | `sync-actions` | Component sync action (test connection, list tables) failures — uses shared job-runner KMS to decrypt OAuth |
| Data Science | `data-science-api` | Python/R workspace lifecycle errors |
