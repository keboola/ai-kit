# editor-service — dependency analysis

## Deployed components
- `editor-api` (Deployment): container `app` (PHP API)
- `editor-consumer` (Deployment, two instances — one per consumerTransport: `connection-audit-log`, `connection-events`): command `messenger:consume <transportName>`
- `editor-session-worker` (Deployment): command `messenger:consume sessionsToProcess`

## Inter-service dependencies
- `editor-api` -> `connection`: `getConnectionServiceUrl` via `Keboola\StorageApiBranch\Factory\ClientOptions` and `Keboola\ManageApi\Client` in services.yaml
- `editor-api` -> `sandboxes`: `getSandboxesApiUrl` via `App\Client\SandboxesClientFactory` in services.yaml
- `editor-api` -> `query`: `getQueryServiceUrl` via `App\Client\QueryApiClientFactory` and `RunQueryAction`/`TablePreviewAction` controllers
- `editor-consumer` -> `connection`: inter-service — subscribes to `connection_events` and `connection_audit_log` topics published by Connection

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `mysql-instance-job-queue` | MySQL instance | job-queue, scheduler, vault, notification, ai, billing | `mysql_config = local.job_queue_mysql_config` in app_editor.tf |
| `sqs-queue-editor-service-sessions` | SQS queue (AWS, Pattern A) | -- (service-owned) | `aws_sqs_queue.editor_service_sessions` (`kbc-editor-service-sessions`) in modules/app-editor-service/aws/queue.tf; DSN exposed as `SESSION_QUEUE_DSN` |
| `servicebus-queue-editor-service-sessions` | Service Bus queue (Azure, Pattern A) | -- (service-owned) | `azurerm_servicebus_queue.editor_service_sessions` (queue `session-transition` in dedicated namespace `editor-service-<md5>`) in modules/app-editor-service/azure/queue.tf |
| `pubsub-topic-editor-service-sessions` | Pub/Sub topic+subscription (GCP, Pattern A) | -- (service-owned) | `google_pubsub_topic.editor_service_sessions` (`editor-service-<stack>-session-workers`) with same-named subscription in modules/app-editor-service/gcp/queue.tf |
| `sns-topic-connection-events` | SNS topic | connection (publisher), vault | `connection_events_topic_arn = module.connection_app.connection_events_topic_arn` in app_editor.tf |
| `sns-topic-connection-audit-log` | SNS topic | connection (publisher) | `connection_audit_log_topic_arn = module.connection_app.connection_audit_log_topic_arn` in app_editor.tf |

## Unresolved
- `applicationToken` in values.yaml (`APPLICATION_TOKEN`) — Manage API token, not a service URL dependency. Used for `Keboola\ManageApi\Client` already captured via `connection`.
