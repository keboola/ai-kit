# job-queue — dependency analysis

## Deployed components

### Group 1 — Public API
- `queue-public-api` (Deployment): sole external-facing component

### Group 2 — Internal API
- `queue-internal-api` (Deployment): PHP REST API, internal only
- `queue-logstash` (Logstash CRD): replicates MySQL to Elasticsearch
- `queue-cleanup` (CronJob, every 12h): deletes jobs for purged projects
- `queue-purge` (CronJob, every 3h): purges old job records
- `queue-replication-check` (CronJob, every 15min): verifies DB to Elasticsearch replication

### Group 3 — Runner (ephemeral per-job pods)
- `queue-runner`: service-container + input-mapping + output-mapping (spawned per job)
- `queue-gelf-logger`: GELF log collector sidecar
- `queue-job-runner` (Legacy): monolithic predecessor to the above runner sub-components

### Group 4 — Daemon
- Scanned separately as `job-queue-daemon`. See job-queue-daemon.md.

## Inter-service dependencies
- `queue-public-api` -> `connection`: `STORAGE_API_URL` + `Keboola\StorageApiBranch` + `Keboola\ManageApi\Client`
- `queue-public-api` -> `queue-internal-api`: `INTERNAL_API_URL` — internal wiring within `queue` container, not cross-container
- `queue-internal-api` -> `connection`: `ServiceClient.getConnectionServiceUrl()`
- `queue-internal-api` -> `elasticsearch`: `ELASTICSEARCH_URL` (self-hosted container)
- `queue-logstash` -> `elasticsearch`: output plugin replicates from MySQL
- `queue-replication-check` -> `elasticsearch`: checks replication lag
- `queue-runner` -> `connection`: `Keboola\StorageApiBranch` in service-container/services.yaml
- `queue-runner` -> `vault`: `Keboola\VaultApiClient` in service-container/services.yaml
- `queue-gelf-logger` -> `connection`: `STORAGE_API_URL` in gelf-logger-server/services.yaml
- `queue-job-runner` -> `connection`: `STORAGE_API_URL` via `Keboola\StorageApiBranch` (legacy)
- `queue-job-runner` -> `queue-internal-api`: `JOB_QUEUE_URL` via `Keboola\JobQueueInternalClient\Client` (legacy)
- `queue-job-runner` -> `vault`: `VAULT_API_URL` via `Keboola\VaultApiClient` (legacy)

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `mysql-instance-job-queue` | MySQL instance | editor, scheduler, vault, notification, ai, billing | `mysql_config = local.job_queue_mysql_config` in app_job_queue_internal_api.tf |
| `kms-key-job-runner-aws` | KMS key (AWS) | encryption-api, job-queue-daemon, sync-actions | `job_runner_kms_key_id` in app-job-queue-public-api/aws/main.tf; injected into runner pods by daemon |
| `kms-key-job-runner-azure` | Key Vault key (Azure) | encryption-api, job-queue-daemon, sync-actions | `azure_key_vault_url` in app-job-queue-public-api/azure/main.tf |
| `kms-key-job-runner-gcp` | Cloud KMS key (GCP) | encryption-api, job-queue-daemon, sync-actions | `GCP_KMS_KEY_ID` in app-job-queue-public-api/gcp/main.tf |

## Self-hosted infrastructure
| Resource | Evidence |
|---|---|
| `elasticsearch` | `ELASTICSEARCH_URL` in internal-api/services.yaml; `ELASTICSEARCH_USER/PASSWORD` in app-job-queue-internal-api/aws/main.tf |

## Unresolved
None.

## Notes
- `queue-runner` KMS credentials are injected by the daemon at pod spawn time via `RunnerConfigurationFactory`, not self-provisioned. The dependency is real even though the runner does not configure it directly.
