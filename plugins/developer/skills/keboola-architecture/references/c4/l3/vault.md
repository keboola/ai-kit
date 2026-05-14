# vault — dependency analysis

## Deployed components
- `vault-api` (Deployment): PHP REST API — CRUD for variables and credentials
- `vault-messenger-consumer-connection-events` (Deployment): command `messenger:consume connection_events` — listens for `devBranchDeleted` events and purges associated branch variables from the local DB

## Inter-service dependencies
- `vault-api` -> `connection`: `Keboola\StorageApiBranch\Factory\ClientOptions` with `STORAGE_API_URL` in services.yaml; `Keboola\StorageApi\Tokens` in `StorageEventRecorder.php` — token validation and audit event recording
- `vault-messenger-consumer-connection-events` -> `connection`: receives `devBranchDeleted` events published by Connection (async, via cloud queue transport)

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `mysql-instance-job-queue` | MySQL instance | job-queue, editor, scheduler, notification, ai, billing | `mysql_config = local.job_queue_mysql_config` in app_vault.tf |
| `sqs-queue-vault-connection-events` | SQS queue (AWS) | — (vault-owned subscription) | `aws_sqs_queue.connection_events` in aws/infra_secrets.tf; `CONNECTION_EVENTS_QUEUE_DSN` = SQS URL |
| `servicebus-queue-vault-connection-events` | Service Bus queue (Azure) | — (vault-owned subscription) | `azurerm_servicebus_queue.connection_events` in azure/infra_secrets.tf; `CONNECTION_EVENTS_QUEUE_DSN` = Service Bus DSN |
| `pubsub-sub-vault-connection-events` | Pub/Sub subscription (GCP) | — (vault-owned subscription) | `google_pubsub_subscription.connection_events` subscribing to `var.connection_events_pub_sub_name` in gcp/main.tf; filter: `storage.devBranchDeleted` only |

## Unresolved
None.

## Notes
- Each cloud variant creates its own queue resource for vault's connection events subscription — AWS creates an SQS queue, Azure a Service Bus queue, GCP a Pub/Sub subscription on Connection's topic. These are not shared with other services.
- The GCP module filters the subscription to `storage.devBranchDeleted` only, unlike AWS/Azure which may receive all connection events and filter in the consumer.
- No KMS/Key Vault dependency — vault does not use `Keboola\ObjectEncryptor`.
