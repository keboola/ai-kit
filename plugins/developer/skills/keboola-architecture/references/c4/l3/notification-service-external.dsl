# Cloud resource relationships for notification-service
# Included at top level of model block in model.dsl

# MySQL — shared job-queue instance
notification-api                -> mysql-instance-job-queue "persists subscriptions and notifications"
notification-messenger-consumer -> mysql-instance-job-queue "reads and updates notifications"
notification-expired-subscription-pruning -> mysql-instance-job-queue "soft-deletes expired subscriptions"

# Internal Messenger transport — service-owned queue per cloud (api publishes, consumer reads)
notification-api                -> sqs-queue-notification-messages         "publishes notification messages on AWS stacks"
notification-messenger-consumer -> sqs-queue-notification-messages         "consumes notification messages on AWS stacks"
notification-api                -> servicebus-queue-notification-messages   "publishes notification messages on Azure stacks"
notification-messenger-consumer -> servicebus-queue-notification-messages   "consumes notification messages on Azure stacks"
notification-api                -> pubsub-topic-notification-messages       "publishes notification messages on GCP stacks"
notification-messenger-consumer -> pubsub-topic-notification-messages       "consumes notification messages on GCP stacks"

# Email delivery
notification-messenger-consumer -> sendgrid "delivers email notifications via Symfony Mailer SendGrid transport"
