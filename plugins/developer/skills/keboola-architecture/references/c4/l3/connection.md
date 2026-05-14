# connection — dependency analysis

## Deployed components

### API (one Deployment, three logical C4 components)
- `connection-storage-api`: REST API `/v1`, `/v2` — Storage tokens, project-scoped
- `connection-manage-api`: REST API `/manage` — Manage tokens, org-scoped
- `connection-payg-api`: REST API `/pay-as-you-go` — PAYG billing

### Queue workers (Deployments)
- `connection-worker-main`: consumes `main` queue
- `connection-worker-commands`: consumes `commands` queue
- `connection-worker-audit-log`: consumes `auditLog` queue
- `connection-worker-events-elastic`: consumes `eventsElastic` queue; indexes events into Elasticsearch
- `connection-publish-worker-metrics`: publishes worker metrics
- `connection-worker-search-index`: Messenger consumer `searchIndex`; maintains global search index
- `connection-worker-user-tasks-scheduler`: Symfony Scheduler `user_tasks`; reads due tasks, dispatches `StorageJobMessage` via cloud queue
- `connection-worker-triggers`: consumes `tableTriggers` queue; fires component jobs via Queue Public API
- `connection-worker-monitoring`: Symfony Scheduler `monitoring`; tests live connections to all customer Snowflake/BigQuery backends
- `connection-worker-certificate-rotation`: Symfony Scheduler `certificate-rotation`; reads/writes MySQL backend credentials; executes DDL directly on customer Snowflake accounts

### CronJobs
- `connection-cronjob-token-expiration`: expires tokens, sessions, invitations; dispatches expiry events (every minute)
- `connection-cronjob-project-purge-scheduler`: enqueues project purge jobs (every 15 min)
- `connection-cronjob-add-audit-log-partition`: MySQL DDL on `bi_auditLog` (yearly)
- `connection-cronjob-delete-events-indices`: deletes old Elasticsearch events indices (monthly)
- `connection-cronjob-roll-elastic-events-index`: rolls active Elasticsearch events index (monthly)
- `connection-cronjob-snapshot-project-metrics`: snapshots per-project metrics (hourly)
- `connection-cronjob-storage-jobs-table-partitioning`: MySQL DDL on `bi_storage_jobs` (daily)
- `connection-cronjob-global-search-table-partitioning`: MySQL DDL on `bi_gs_consistency` (daily)
- `connection-cronjob-sync-apps`: downloads UI app definitions from reference Connection stack (every 5 min)
- `connection-cronjob-workers-expiration`: expires stale workers (daily)
- `connection-cronjob-release-staled-locks`: releases locks held by terminated pods (every 2 min)
- `connection-cronjob-clear-expired-oauth-tokens`: deletes expired OAuth2 server tokens (hourly)
- `connection-cronjob-sync-components`: fetches component definitions from Developer Portal (conditional)

## Inter-service dependencies (within keboolaPlatform)
- `connection-worker-triggers` -> `queue-public-api`: `Keboola\JobQueueClient\Client` via `stackInfo->getService('queue')` — fires component jobs when table triggers activate
- `connection-manage-api` -> `sandboxes`: `Keboola\Sandboxes\Api\ManageClient` via `stackInfo->getService('sandboxes')` — CLI commands only (Snowflake hostname change, BYODB migration)
- `connection-storage-api`, `connection-manage-api`, `connection-worker-events-elastic`, `connection-worker-search-index`, `connection-cronjob-delete-events-indices`, `connection-cronjob-roll-elastic-events-index` -> `elasticsearch`

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `mysql-instance-connection` | MySQL instance | connection only | `mysql_config = local.connection_mysql_config` in app_connection.tf; CFn: kbc-connection-rds |
| `sns-topic-connection-events` | SNS topic | editor (subscriber), vault (subscriber) | `connection_events_topic_arn` output from `module.connection_app` in app_connection.tf |
| `sns-topic-connection-audit-log` | SNS topic | editor (subscriber) | `connection_audit_log_topic_arn` output from `module.connection_app` in app_connection.tf |
| `s3-bucket-logs` | Object storage | sync-actions, omnisearch | `s3_logs_bucket = data.aws_cloudformation_stack.kbc_logs_bucket...` in app_connection.tf |
| `sendgrid` | SaaS | — | SMTP relay via `smtp.sendgrid.net`; project invitations, token sharing, notifications |
| `stripe` | SaaS | — | `PayAsYouGo_Service_Stripe` in connection-payg-api; credit purchases and webhook events |

## External storage backends (via connection-storage-api)
| System | Status | Evidence |
|---|---|---|
| `snowflake` | Active | `Package/StorageDriverSnowflake` |
| `bigquery` | Active | `Package/StorageDriverBigQuery` |
| `synapse` | Legacy | `SynapseConnectionManager` in legacy-app |
| `exasol` | Legacy | `StorageDriverExasol` in legacy-app |
| `supabase` | Uncommissioned | `Package/StorageDriverSupabase` |

## Notes
- Elasticsearch config is injected by the Helm chart's cert-copy job via `connection-elasticsearch-urls` secret — not in Terraform infra_secrets.
- Connection uses its own symmetric `ENCRYPTION_KEYS__*` env vars for token encryption — NOT `Keboola\ObjectEncryptor` / KMS. No KMS/Key Vault dependency.
- `%keboolaServices%` exposes service URLs to callers. Only `queue` and `sandboxes` are consumed internally. `oauth`, `import`, `syrup` are pass-through only — not modelled as inter-service dependencies.
- Storage jobs (`Storage_Service_Jobs`, `bi_storage_jobs`) are internal Connection operations — unrelated to the Queue service. Do not confuse with component jobs (`Keboola\JobQueueClient`).
- `connection-cronjob-sync-apps` calls another Connection instance via HTTP — a cross-stack self-call, not an inter-service dependency.
