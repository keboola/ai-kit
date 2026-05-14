# oauth-service — dependency analysis

## Deployed components
- `oauth-service-api` (Deployment): PHP Symfony REST API. OAuth credentials broker — stores, encrypts, and serves OAuth credentials to authorized platform services.
- `oauth-service-messenger-consumer-connection-events` (Deployment): command `messenger:consume connection_events` — listens for `devBranchDeleted` events and purges associated OAuth sessions from the local DB. Pattern B fan-out subscription.
- `oauth-service-session-expiration` (CronJob, every 15 min): command `app:expire-auth-sessions` — soft-expires old authentication sessions.
- `oauth-service-serverless-proxy` (Deployment, conditional via `.Values.serverlessProxy.enabled`): nginx reverse proxy to serverless OAuth target. Infrastructure routing detail — not modelled as a C4 component.

## Skipped (helm hooks)
- `oauth-service-db-migration` (Job, `helm.sh/hook: pre-install,pre-upgrade`) — deploy-time DB migration
- `oauth-service-legacy-oauth-migration` (Job, `helm.sh/hook: post-install,post-upgrade`) — deploy-time legacy data migration

## Inter-service dependencies
- `oauth-service-api` -> `connection`: `Keboola\StorageApiBranch\Factory\ClientOptions` using `STORAGE_API_URL` — token verification and project data
- `oauth-service-messenger-consumer-connection-events` -> `connection`: receives `devBranchDeleted` events published by Connection (async, via cloud queue transport)

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `mysql-instance-job-queue` | MySQL instance | job-queue, editor, scheduler, vault, notification, ai, billing | `mysql_config = local.job_queue_mysql_config` in app_oauth_service.tf |
| `kms-key-oauth-aws` | KMS key (AWS) | — (service-owned) | `aws_kms_key.oauth_service` in aws/kms.tf; `AWS_KMS_KEY_ID = aws_kms_key.oauth_service.id` |
| `kms-key-oauth-azure` | Key Vault (Azure) | — (service-owned) | `azurerm_key_vault.oauth_service` in azure/keyvault.tf; `AZURE_KEY_VAULT_URL` |
| `kms-key-oauth-gcp` | Cloud KMS key (GCP) | — (service-owned) | `google_kms_crypto_key.oauth_service_encryption` in gcp/main.tf; `GCP_KMS_KEY_ID` |
| `sqs-queue-oauth-connection-events` | SQS queue (AWS) | — (oauth-owned) | `aws_sqs_queue.connection_events` + `aws_sns_topic_subscription` in aws/queue.tf; filtered to `storage.devBranchDeleted` |
| `servicebus-queue-oauth-connection-events` | Service Bus queue (Azure) | — (oauth-owned) | `azurerm_servicebus_queue.connection_events` in azure/queues.tf; EventGrid subscription on `connection_events_eventgrid_topic_id` |
| `pubsub-sub-oauth-connection-events` | Pub/Sub subscription (GCP) | — (oauth-owned) | `google_pubsub_subscription.connection_events` in gcp/main.tf; subscribes to `kbc-{stack}-events`; filtered to `storage.devBranchDeleted` |

## Unresolved
None.

## Notes
- Legacy migration resources (`LEGACY_OAUTH_DYNAMO_*`, `LEGACY_OAUTH_COSMOSDB_*`, `LEGACY_OAUTH_KMS_ARN`, `LEGACY_OAUTH_KEY_VAULT_URL`) are temporary cross-account/cross-service resources used during migration from the old Node.js oauth-api and Lambda-based service. Marked as TEMPORARY in Terraform comments. Not modelled as named resource instances — they will be removed after migration.
- The `oauth-service-serverless-proxy` Deployment (nginx) is a routing infrastructure component conditionally deployed to proxy requests to a serverless variant. It has no direct Keboola service dependencies and is not modelled as a C4 component.
