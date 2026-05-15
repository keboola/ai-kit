# scheduler — dependency analysis

## Deployed components
- `scheduler-api` (Deployment): container `scheduler-api` (PHP REST API)
- `scheduler-cron` (CronJob, every minute): command `php bin/console app:run`

## Inter-service dependencies
- `scheduler-api` -> `connection`: `storage_api_url` via `Keboola\StorageApiBranch` in services.yaml
- `scheduler-cron` -> `connection`: `storage_api_url` via `Keboola\StorageApiBranch` in services.yaml
- `scheduler-cron` -> `queue`: `queue_api_url` via `Keboola\App\JobQueueClientFactory` in services.yaml

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `mysql-instance-job-queue` | MySQL instance | job-queue, editor, vault, notification, ai, billing | `mysql_config = local.job_queue_mysql_config` in app_scheduler.tf |

## Unresolved
None.
