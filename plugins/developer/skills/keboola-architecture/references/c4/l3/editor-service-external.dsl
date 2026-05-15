# Cloud resource relationships for editor-service
# Included at top level of model block in model.dsl

editor-api            -> mysql-instance-job-queue "persists application data (shares job-queue MySQL instance)"
editor-api            -> kms-key-editor-aws   "encrypts data at rest on AWS stacks"
editor-api            -> kms-key-editor-azure "encrypts data at rest on Azure stacks"
editor-api            -> kms-key-editor-gcp   "encrypts data at rest on GCP stacks"

editor-session-worker -> mysql-instance-job-queue "persists session state (shares job-queue MySQL instance)"
editor-session-worker -> kms-key-editor-aws   "encrypts session tokens on AWS stacks"
editor-session-worker -> kms-key-editor-azure "encrypts session tokens on Azure stacks"
editor-session-worker -> kms-key-editor-gcp   "encrypts session tokens on GCP stacks"

# Internal session queue -- Pattern A (editor-api publishes, editor-session-worker consumes)
editor-api            -> sqs-queue-editor-service-sessions        "publishes ProcessSessionMessage on AWS stacks"
editor-api            -> servicebus-queue-editor-service-sessions "publishes ProcessSessionMessage on Azure stacks"
editor-api            -> pubsub-topic-editor-service-sessions     "publishes ProcessSessionMessage on GCP stacks"

editor-session-worker -> sqs-queue-editor-service-sessions        "consumes ProcessSessionMessage on AWS stacks"
editor-session-worker -> servicebus-queue-editor-service-sessions "consumes ProcessSessionMessage on Azure stacks"
editor-session-worker -> pubsub-topic-editor-service-sessions     "consumes ProcessSessionMessage on GCP stacks"

# Connection events consumer -- Pattern B fan-out subscriptions
editor-consumer       -> sqs-queue-editor-service-connection-events        "consumes connection events on AWS stacks"
editor-consumer       -> servicebus-queue-editor-service-connection-events "consumes connection events on Azure stacks"
editor-consumer       -> pubsub-sub-editor-service-connection-events       "consumes connection events on GCP stacks"

editor-consumer       -> sqs-queue-editor-service-connection-audit-log        "consumes audit log events on AWS stacks"
editor-consumer       -> servicebus-queue-editor-service-connection-audit-log "consumes audit log events on Azure stacks"
editor-consumer       -> pubsub-sub-editor-service-connection-audit-log       "consumes audit log events on GCP stacks"

# Service-owned queues receive from Connection's topics (fan-out topology)
sqs-queue-editor-service-connection-events        -> sns-topic-connection-events       "subscribed via aws_sns_topic_subscription"
servicebus-queue-editor-service-connection-events -> eventgrid-topic-connection-events "subscribed via azurerm_eventgrid_event_subscription"
pubsub-sub-editor-service-connection-events       -> pubsub-topic-connection-events    "subscribed via google_pubsub_subscription"

sqs-queue-editor-service-connection-audit-log        -> sns-topic-connection-audit-log       "subscribed via aws_sns_topic_subscription"
servicebus-queue-editor-service-connection-audit-log -> eventgrid-topic-connection-audit-log "subscribed via azurerm_eventgrid_event_subscription"
pubsub-sub-editor-service-connection-audit-log       -> pubsub-topic-connection-audit-log    "subscribed via google_pubsub_subscription"
