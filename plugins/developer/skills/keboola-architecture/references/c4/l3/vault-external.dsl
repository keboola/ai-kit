# Cloud resource relationships for vault
# Included at top level of model block in model.dsl

vault-api                                  -> mysql-instance-job-queue "persists variables (shares job-queue MySQL instance)"

# Messenger consumer reads from vault-owned queue subscriptions on each cloud.
# Each queue is fanned out from Connection's per-cloud events topic.
vault-messenger-consumer-connection-events -> mysql-instance-job-queue                    "deletes branch variables on devBranchDeleted events"
vault-messenger-consumer-connection-events -> sqs-queue-vault-connection-events           "consumes devBranchDeleted events on AWS stacks (subscribed to sns-topic-connection-events)"
vault-messenger-consumer-connection-events -> servicebus-queue-vault-connection-events    "consumes devBranchDeleted events on Azure stacks (fanned from eventgrid-topic-connection-events)"
vault-messenger-consumer-connection-events -> pubsub-sub-vault-connection-events          "consumes devBranchDeleted events on GCP stacks (subscribed to pubsub-topic-connection-events)"

# The vault-owned queues receive from Connection's events topics
sqs-queue-vault-connection-events          -> sns-topic-connection-events                 "subscribed via aws_sns_topic_subscription"
servicebus-queue-vault-connection-events   -> eventgrid-topic-connection-events           "subscribed via azurerm_eventgrid_event_subscription"
pubsub-sub-vault-connection-events         -> pubsub-topic-connection-events              "subscribed via google_pubsub_subscription"
