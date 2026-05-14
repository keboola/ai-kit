# job-queue-daemon — dependency analysis

## Deployed components (data-driven from values.yaml)

### Deployments
- `queue-daemon-run` (Deployment): command `app:run` — main daemon loop
- `queue-daemon-start` (Deployment): command `messenger:consume jobsToStart`
- `queue-daemon-stop` (Deployment): command `app:stop` — graceful job stopping
- `queue-daemon-flow-transition` (Deployment): command `messenger:consume flowJobsTransition`

### CronJobs
- `daemon-cron-pod-cleanup` (CronJob, every 10min): cleans up orphaned K8s pods via Kubernetes API
- `daemon-cron-db-cleanup` (CronJob, every hour): cleans up stale DB records
- `daemon-cron-flow-cleanup` (CronJob, every 30min): removes stale flow job data

## Inter-service dependencies
- All daemon deployments -> `connection`: `STORAGE_API_URL_INTERNAL` via `Keboola\StorageApiBranch` and `Keboola\ManageApi\Client`
- All daemon deployments -> `queue-internal-api`: `DAEMON_INTERNAL_QUEUE_API_URL` via `Keboola\JobQueueInternalClient\Client`
- `queue-daemon-run` + `queue-daemon-stop` -> `notification`: `Keboola\NotificationClient\ClientFactory`
- `queue-daemon-run` -> `billing`: `Keboola\BillingApi\ClientFactory` (conditional on `BILLING_ENABLED`)
- `queue-daemon-run` + `queue-daemon-start` -> `vault`: `VAULT_API_URL` in `App\Daemon\RunnerConfigurationFactory`
- `daemon-cron-db-cleanup` -> `queue-internal-api`: cleans up internal API DB records
- `daemon-cron-flow-cleanup` -> `queue-internal-api`: removes stale flow job data

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `mysql-instance-job-queue` | MySQL instance | job-queue, editor, scheduler, vault, notification, ai, billing | `mysql_config = local.job_queue_mysql_config` in app_job_queue_daemon.tf |
| `kms-key-job-runner-aws` | KMS key (AWS) | encryption-api, queue-runner, sync-actions | `job_runner_kms_arn = local.job_runner_kms_arn` in app_job_queue_daemon.tf |
| `kms-key-job-runner-azure` | Key Vault key (Azure) | encryption-api, queue-runner, sync-actions | `azure_key_vault_url` in azure/main.tf |
| `kms-key-job-runner-gcp` | Cloud KMS key (GCP) | encryption-api, queue-runner, sync-actions | `GCP_KMS_KEY_ID` in gcp/main.tf |

## Unresolved
None.

## Notes
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in all cloud variants — deprecated ECR auth credentials. Not an AWS storage dependency.
- `RUNNER_INTERNAL_QUEUE_API_URL` in `K8sManifestsFactory` is configuration injected into spawned job pods — NOT a direct daemon dependency.
- `daemon-cron-pod-cleanup` calls the Kubernetes API directly to clean up orphaned pods. This is an application-level K8s dependency modelled in `-external.dsl`.
