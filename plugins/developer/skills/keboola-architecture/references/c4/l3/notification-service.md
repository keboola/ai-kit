# notification-service — dependency analysis

## Deployed components
- `notification-api` (Deployment): PHP Symfony REST API — accepts events and subscription management requests, publishes onto internal Messenger transport
- `notification-messenger-consumer` (Deployment): command `messenger:consume notifications` — processes Event messages (matches subscriptions) and NotificationMessage (delivers via SendGrid or customer webhook)
- `notification-expired-subscription-pruning` (CronJob, every 10 min): command `app:expire-subscriptions` — soft-deletes expired project subscriptions

## Inter-service dependencies
- `notification-api` -> `connection`: `getConnectionServiceUrl()` via `ServiceClient` in `ManageApiClientFactory`, `StorageApiBranch\Factory\ClientOptions`, and `StorageApiIndexClient` in services.yaml
- `notification-messenger-consumer` -> `connection`: token verification

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `mysql-instance-job-queue` | MySQL instance | job-queue, editor, scheduler, vault, ai, billing | `mysql_config = local.job_queue_mysql_config` in app_notification_service.tf |
| `sqs-queue-notification-messages` | SQS queue (AWS) | — (service-owned) | `aws_sqs_queue.messages` in aws/queue.tf; `MESSENGER_TRANSPORT_DSN` = SQS URL in aws/infra_secrets.tf |
| `servicebus-queue-notification-messages` | Service Bus queue (Azure) | — (service-owned) | `azurerm_servicebus_queue.notification_service_messages` in azure module; `MESSENGER_TRANSPORT_DSN` = Service Bus DSN in azure/infra_secrets.tf |
| `pubsub-topic-notification-messages` | Pub/Sub topic+subscription (GCP) | — (service-owned) | `google_pubsub_topic/subscription.notification_service_messages_queue` in gcp/main.tf; `MESSENGER_TRANSPORT_DSN` = Pub/Sub DSN |

## Unresolved
None.

## Notes
- The `MESSENGER_TRANSPORT_DSN` in all three cloud variants points to a **service-owned** queue — notification creates its own queue on each cloud. This is NOT a subscription to Connection events. The API publishes to this queue; the consumer reads from it. This is internal Symfony Messenger wiring.
- `sendgrid` is used for email delivery by the messenger consumer — modelled as a Vendor relationship in `-external.dsl`.
- No KMS/Key Vault dependency — notification does not use `Keboola\ObjectEncryptor`.
