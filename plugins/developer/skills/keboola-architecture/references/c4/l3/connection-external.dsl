# Cloud resource relationships for connection
# Included at top level of model block in model.dsl

# MySQL -- connection has its own dedicated instance
connection-storage-api                              -> mysql-instance-connection    "persists all platform data (projects, tokens, configs, events, audit log)"
connection-manage-api                               -> mysql-instance-connection    "persists organisation and project management data"
connection-payg-api                                 -> mysql-instance-connection    "persists PAYG billing and credits data"
connection-worker-main                              -> mysql-instance-connection    "processes storage jobs from main queue"
connection-worker-commands                          -> mysql-instance-connection    "processes command messages"
connection-worker-audit-log                         -> mysql-instance-connection    "writes audit log entries"
connection-worker-events-elastic                    -> mysql-instance-connection    "reads events for Elasticsearch indexing"
connection-worker-search-index                      -> mysql-instance-connection    "reads data for global search index"
connection-worker-triggers                          -> mysql-instance-connection    "reads table trigger configurations"
connection-worker-user-tasks-scheduler              -> mysql-instance-connection    "reads scheduled tasks and enqueues storage jobs"
connection-worker-monitoring                        -> mysql-instance-connection    "reads storage backend credentials for health checks"
connection-worker-certificate-rotation              -> mysql-instance-connection    "reads and writes storage backend certificate records"
connection-cronjob-token-expiration                 -> mysql-instance-connection    "deletes expired storage/manage tokens, invitations, sessions, and project-admin associations"
connection-cronjob-project-purge-scheduler          -> mysql-instance-connection    "reads deleted projects due for purge"
connection-cronjob-sync-apps                        -> mysql-instance-connection    "writes synced UI app definitions from reference Connection stack"
connection-cronjob-sync-components                  -> mysql-instance-connection    "writes synced component definitions to the apis table"
connection-cronjob-storage-jobs-table-partitioning  -> mysql-instance-connection    "manages bi_storage_jobs MySQL range partitions"
connection-cronjob-global-search-table-partitioning -> mysql-instance-connection    "manages bi_gs_consistency MySQL range partitions"
connection-cronjob-add-audit-log-partition          -> mysql-instance-connection    "manages bi_auditLog MySQL range partitions"
connection-cronjob-snapshot-project-metrics         -> mysql-instance-connection    "snapshots per-project metrics"
connection-cronjob-workers-expiration               -> mysql-instance-connection    "expires stale workers"
connection-cronjob-clear-expired-oauth-tokens       -> mysql-instance-connection    "clears expired OAuth 2 server tokens"

# Connection internal queues (Pattern A -- Connection both publishes and workers consume)
# main
connection-storage-api                              -> sqs-queue-connection-main              "enqueues storage jobs on AWS stacks"
connection-worker-main                              -> sqs-queue-connection-main              "consumes storage jobs on AWS stacks"
connection-worker-user-tasks-scheduler              -> sqs-queue-connection-main              "enqueues scheduled storage jobs on AWS stacks"
connection-storage-api                              -> servicebus-queue-connection-main       "enqueues storage jobs on Azure stacks"
connection-worker-main                              -> servicebus-queue-connection-main       "consumes storage jobs on Azure stacks"
connection-worker-user-tasks-scheduler              -> servicebus-queue-connection-main       "enqueues scheduled storage jobs on Azure stacks"
connection-storage-api                              -> pubsub-topic-connection-main           "enqueues storage jobs on GCP stacks"
connection-worker-main                              -> pubsub-topic-connection-main           "consumes storage jobs on GCP stacks"
connection-worker-user-tasks-scheduler              -> pubsub-topic-connection-main           "enqueues scheduled storage jobs on GCP stacks"

# commands
connection-storage-api                              -> sqs-queue-connection-commands          "enqueues CLI commands on AWS stacks"
connection-cronjob-project-purge-scheduler          -> sqs-queue-connection-commands          "enqueues project-purge commands on AWS stacks"
connection-worker-commands                          -> sqs-queue-connection-commands          "consumes commands on AWS stacks"
connection-storage-api                              -> servicebus-queue-connection-commands   "enqueues CLI commands on Azure stacks"
connection-cronjob-project-purge-scheduler          -> servicebus-queue-connection-commands   "enqueues project-purge commands on Azure stacks"
connection-worker-commands                          -> servicebus-queue-connection-commands   "consumes commands on Azure stacks"
connection-storage-api                              -> pubsub-topic-connection-commands       "enqueues CLI commands on GCP stacks"
connection-cronjob-project-purge-scheduler          -> pubsub-topic-connection-commands       "enqueues project-purge commands on GCP stacks"
connection-worker-commands                          -> pubsub-topic-connection-commands       "consumes commands on GCP stacks"

# eventsElastic (subscriber queue, fanned out from sns-topic-connection-events)
connection-worker-events-elastic                    -> sqs-queue-connection-events-elastic           "consumes events for Elasticsearch indexing on AWS stacks"
connection-worker-events-elastic                    -> servicebus-queue-connection-events-elastic    "consumes events for Elasticsearch indexing on Azure stacks"
connection-worker-events-elastic                    -> pubsub-sub-connection-events-elastic          "consumes events for Elasticsearch indexing on GCP stacks"

# auditLogEvents (subscriber queue, fanned out from sns-topic-connection-audit-log)
connection-worker-audit-log                         -> sqs-queue-connection-audit-log-events          "consumes audit log entries on AWS stacks"
connection-worker-audit-log                         -> servicebus-queue-connection-audit-log-events   "consumes audit log entries on Azure stacks"
connection-worker-audit-log                         -> pubsub-sub-connection-audit-log-events         "consumes audit log entries on GCP stacks"

# tableTriggers (subscriber queue, fanned out from sns-topic-connection-events with filter storage.tableImportDone)
connection-worker-triggers                          -> sqs-queue-connection-table-triggers          "consumes table trigger events on AWS stacks"
connection-worker-triggers                          -> servicebus-queue-connection-table-triggers   "consumes table trigger events on Azure stacks"
connection-worker-triggers                          -> pubsub-sub-connection-table-triggers         "consumes table trigger events on GCP stacks"

# searchIndex (Symfony Messenger transport; subscriber queue fanned out from sns-topic-connection-search-index)
connection-worker-search-index                      -> sqs-queue-connection-search-index          "consumes search index updates on AWS stacks"
connection-worker-search-index                      -> servicebus-queue-connection-search-index   "consumes search index updates on Azure stacks"
connection-worker-search-index                      -> pubsub-sub-connection-search-index         "consumes search index updates on GCP stacks"

# Fan-out topics (Connection publishes; subscribers consume via owned queues)
# events: subscribers are connection's own (events-elastic, table-triggers) plus editor, vault, oauth, sandboxes-service
connection-storage-api                              -> sns-topic-connection-events           "publishes storage events on AWS stacks"
connection-storage-api                              -> eventgrid-topic-connection-events     "publishes storage events on Azure stacks"
connection-storage-api                              -> pubsub-topic-connection-events        "publishes storage events on GCP stacks"

# audit-log: subscribers are connection's own (audit-log-events) plus editor, sandboxes-service
connection-storage-api                              -> sns-topic-connection-audit-log        "publishes audit log entries on AWS stacks"
connection-storage-api                              -> eventgrid-topic-connection-audit-log  "publishes audit log entries on Azure stacks"
connection-storage-api                              -> pubsub-topic-connection-audit-log     "publishes audit log entries on GCP stacks"

# search-index: only connection's own search-index queue subscribes (topic ARN is not exposed)
connection-storage-api                              -> sns-topic-connection-search-index           "publishes search index updates on AWS stacks"
connection-storage-api                              -> eventgrid-topic-connection-search-index     "publishes search index updates on Azure stacks"
connection-storage-api                              -> pubsub-topic-connection-search-index        "publishes search index updates on GCP stacks"

# Topic subscriptions: Connection-owned subscriber queues receive from Connection's fan-out topics
sqs-queue-connection-events-elastic           -> sns-topic-connection-events            "subscribed via aws_sns_topic_subscription"
servicebus-queue-connection-events-elastic    -> eventgrid-topic-connection-events      "subscribed via azurerm_eventgrid_event_subscription"
pubsub-sub-connection-events-elastic          -> pubsub-topic-connection-events         "subscribed via google_pubsub_subscription"

sqs-queue-connection-audit-log-events         -> sns-topic-connection-audit-log         "subscribed via aws_sns_topic_subscription"
servicebus-queue-connection-audit-log-events  -> eventgrid-topic-connection-audit-log   "subscribed via azurerm_eventgrid_event_subscription"
pubsub-sub-connection-audit-log-events        -> pubsub-topic-connection-audit-log      "subscribed via google_pubsub_subscription"

sqs-queue-connection-table-triggers           -> sns-topic-connection-events            "subscribed via aws_sns_topic_subscription with filter eventName=storage.tableImportDone"
servicebus-queue-connection-table-triggers    -> eventgrid-topic-connection-events      "subscribed via azurerm_eventgrid_event_subscription with included_event_types=storage.tableImportDone"
pubsub-sub-connection-table-triggers          -> pubsub-topic-connection-events         "subscribed via google_pubsub_subscription with filter on storage.tableImportDone"

sqs-queue-connection-search-index             -> sns-topic-connection-search-index      "subscribed via aws_sns_topic_subscription"
servicebus-queue-connection-search-index      -> eventgrid-topic-connection-search-index "subscribed via azurerm_eventgrid_event_subscription"
pubsub-sub-connection-search-index            -> pubsub-topic-connection-search-index   "subscribed via google_pubsub_subscription"

# S3 logs bucket
connection-storage-api                              -> s3-bucket-logs "stores debug log attachments"

# SaaS integrations
# SendGrid is used by multiple components (all three APIs + certificate-rotation worker)
connection-storage-api                              -> sendgrid "sends token sharing and merge request lifecycle emails"
connection-manage-api                               -> sendgrid "sends project invitations and Snowflake Partner Connect welcome emails"
connection-payg-api                                 -> sendgrid "sends PAYG registration welcome emails"
connection-worker-certificate-rotation              -> sendgrid "sends SAML2 certificate expiry warnings to backend technical owners"
connection-payg-api                                 -> stripe   "processes pay-as-you-go credit purchases and webhook events"

# Developer Portal
connection-cronjob-sync-components                  -> devPortalApi "fetches component definitions for sync into local database"

# Storage backends
connection-worker-monitoring                        -> snowflake "tests live connections to customer Snowflake accounts (health checks)"
connection-worker-monitoring                        -> bigquery  "tests live connections to customer BigQuery accounts (health checks)"
connection-worker-certificate-rotation              -> snowflake "executes DDL on customer Snowflake accounts (ALTER USER SET RSA_PUBLIC_KEY_N)"

# Kubernetes API
connection-cronjob-release-staled-locks             -> aws-eks   "lists pods to release stale locks on AWS stacks"
connection-cronjob-release-staled-locks             -> azure-aks "lists pods to release stale locks on Azure stacks"
connection-cronjob-release-staled-locks             -> gcp-gke   "lists pods to release stale locks on GCP stacks"
