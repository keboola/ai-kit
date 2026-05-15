# Cloud resource relationships for oauth-service
# Included at top level of model block in model.dsl

# MySQL -- shares job-queue instance
oauth-service-api                                  -> mysql-instance-job-queue "persists OAuth credentials, sessions, and consumers"
oauth-service-messenger-consumer-connection-events -> mysql-instance-job-queue "deletes OAuth sessions on devBranchDeleted events"
oauth-service-session-expiration                   -> mysql-instance-job-queue "expires old auth sessions (every 15 min)"

# Service-owned KMS keys (ObjectEncryptor for credential encryption)
oauth-service-api                                  -> kms-key-oauth-aws   "encrypts and decrypts OAuth credentials on AWS stacks"
oauth-service-api                                  -> kms-key-oauth-azure "encrypts and decrypts OAuth credentials on Azure stacks"
oauth-service-api                                  -> kms-key-oauth-gcp   "encrypts and decrypts OAuth credentials on GCP stacks"

# Pattern B -- fan-out subscriptions from Connection events topics
oauth-service-messenger-consumer-connection-events -> sqs-queue-oauth-connection-events          "consumes devBranchDeleted events on AWS stacks"
oauth-service-messenger-consumer-connection-events -> servicebus-queue-oauth-connection-events   "consumes devBranchDeleted events on Azure stacks"
oauth-service-messenger-consumer-connection-events -> pubsub-sub-oauth-connection-events         "consumes devBranchDeleted events on GCP stacks"

sqs-queue-oauth-connection-events          -> sns-topic-connection-events        "subscribed via aws_sns_topic_subscription (filtered: devBranchDeleted)"
servicebus-queue-oauth-connection-events   -> eventgrid-topic-connection-events  "subscribed via azurerm_eventgrid_event_subscription (filtered: devBranchDeleted)"
pubsub-sub-oauth-connection-events         -> pubsub-topic-connection-events     "subscribed via google_pubsub_subscription (filtered: devBranchDeleted)"
