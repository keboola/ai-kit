    # -------------------------------------------------------------------------
    # Named Cloud Resource Instances
    # -------------------------------------------------------------------------

    # --- MySQL instances ---

    mysql-instance-connection = softwareSystem "MySQL: connection" "Dedicated MySQL instance hosting only the Connection database. CFn: kbc-connection-rds." {
        tags "CloudResource" "MySQL"
    }
    mysql-instance-job-queue = softwareSystem "MySQL: job-queue" "Shared MySQL instance hosting databases for: job-queue, editor, scheduler, vault, notification, ai, billing, oauth. CFn: kbc-job-queue-rds." {
        tags "CloudResource" "MySQL"
    }

    # --- Shared KMS / Key Vault keys (job-runner) ---

    kms-key-job-runner-aws = softwareSystem "KMS Key: job-runner (AWS)" "Shared AWS KMS key for job payload encryption/decryption. CFn: kbc-job-runner-kms-key." {
        tags "CloudResource" "KMS" "AWS"
    }
    kms-key-job-runner-azure = softwareSystem "Key Vault Key: job-runner (Azure)" "Shared Azure Key Vault key for job payload encryption/decryption." {
        tags "CloudResource" "KeyVault" "Azure"
    }
    kms-key-job-runner-gcp = softwareSystem "Cloud KMS Key: job-runner (GCP)" "Shared GCP Cloud KMS key for job payload encryption/decryption." {
        tags "CloudResource" "KMS" "GCP"
    }

    # --- Service-owned KMS / Key Vault keys ---

    kms-key-ai-aws = softwareSystem "KMS Key: ai-service (AWS)" "AI service dedicated AWS KMS key." {
        tags "CloudResource" "KMS" "AWS"
    }
    kms-key-ai-azure = softwareSystem "Key Vault: ai-service (Azure)" "AI service dedicated Azure Key Vault." {
        tags "CloudResource" "KeyVault" "Azure"
    }
    kms-key-ai-gcp = softwareSystem "Cloud KMS Key: ai-service (GCP)" "AI service dedicated GCP Cloud KMS key." {
        tags "CloudResource" "KMS" "GCP"
    }

    kms-key-scheduler-aws = softwareSystem "KMS Key: scheduler (AWS)" "Scheduler dedicated AWS KMS key." {
        tags "CloudResource" "KMS" "AWS"
    }
    kms-key-scheduler-azure = softwareSystem "Key Vault: scheduler (Azure)" "Scheduler dedicated Azure Key Vault key." {
        tags "CloudResource" "KeyVault" "Azure"
    }
    kms-key-scheduler-gcp = softwareSystem "Cloud KMS Key: scheduler (GCP)" "Scheduler dedicated GCP Cloud KMS key." {
        tags "CloudResource" "KMS" "GCP"
    }

    kms-key-editor-aws = softwareSystem "KMS Key: editor-service (AWS)" "Editor service dedicated AWS KMS key." {
        tags "CloudResource" "KMS" "AWS"
    }
    kms-key-editor-azure = softwareSystem "Key Vault: editor-service (Azure)" "Editor service dedicated Azure Key Vault key." {
        tags "CloudResource" "KeyVault" "Azure"
    }
    kms-key-editor-gcp = softwareSystem "Cloud KMS Key: editor-service (GCP)" "Editor service dedicated GCP Cloud KMS key." {
        tags "CloudResource" "KMS" "GCP"
    }

    kms-key-oauth-aws = softwareSystem "KMS Key: oauth-service (AWS)" "OAuth service dedicated AWS KMS key for ObjectEncryptor." {
        tags "CloudResource" "KMS" "AWS"
    }
    kms-key-oauth-azure = softwareSystem "Key Vault: oauth-service (Azure)" "OAuth service dedicated Azure Key Vault key." {
        tags "CloudResource" "KeyVault" "Azure"
    }
    kms-key-oauth-gcp = softwareSystem "Cloud KMS Key: oauth-service (GCP)" "OAuth service dedicated GCP Cloud KMS key." {
        tags "CloudResource" "KMS" "GCP"
    }

    kms-key-stream-aws = softwareSystem "KMS Key: stream (AWS)" "Stream service dedicated AWS KMS key. Encrypts data payloads written to disk volumes." {
        tags "CloudResource" "KMS" "AWS"
    }
    kms-key-stream-azure = softwareSystem "Key Vault: stream (Azure)" "Stream service dedicated Azure Key Vault key. Encrypts data payloads written to disk volumes." {
        tags "CloudResource" "KeyVault" "Azure"
    }
    kms-key-stream-gcp = softwareSystem "Cloud KMS Key: stream (GCP)" "Stream service dedicated GCP Cloud KMS key. Encrypts data payloads written to disk volumes." {
        tags "CloudResource" "KMS" "GCP"
    }

    kms-key-ai-chat-gcp = softwareSystem "Cloud KMS Key: ai-chat GCS bucket (GCP)" "GCP-only. Used for GCS bucket encryption-at-rest for KAI app storage buckets. Not application-level encryption." {
        tags "CloudResource" "KMS" "GCP"
    }

    # --- sandboxes-service KMS keys (service-owned) ---

    kms-key-sandboxes-service-aws = softwareSystem "KMS Key: sandboxes-service (AWS)" "Service-owned AWS KMS key for sandboxes-service internal encryption. Resource: aws_kms_key.sandboxes_service." {
        tags "CloudResource" "KMS" "AWS"
    }
    kms-key-sandboxes-service-azure = softwareSystem "Key Vault Key: sandboxes-service (Azure)" "Service-owned Azure Key Vault key for sandboxes-service internal encryption." {
        tags "CloudResource" "KeyVault" "Azure"
    }
    kms-key-sandboxes-service-gcp = softwareSystem "GCP KMS Key: sandboxes-service (GCP)" "Service-owned GCP Cloud KMS key for sandboxes-service internal encryption." {
        tags "CloudResource" "KMS" "GCP"
    }

    # --- sandboxes-service Pattern B queues (subscriber-owned, fan-out from Connection) ---

    sqs-queue-sandboxes-service-connection-events = softwareSystem "SQS Queue: sandboxes-service-connection-events (AWS)" "Subscriber-owned SQS queue. Receives Connection events via SNS fan-out." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-sandboxes-service-connection-events = softwareSystem "Service Bus Queue: sandboxes-service-connection-events (Azure)" "Subscriber-owned Service Bus queue. Receives Connection events via Event Grid." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-sandboxes-service-connection-events = softwareSystem "Pub/Sub Sub: sandboxes-service-connection-events (GCP)" "Subscriber-owned Pub/Sub subscription. Receives Connection events." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    sqs-queue-sandboxes-service-connection-audit-log = softwareSystem "SQS Queue: sandboxes-service-connection-audit-log (AWS)" "Subscriber-owned SQS queue. Receives Connection audit log events via SNS fan-out." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-sandboxes-service-connection-audit-log = softwareSystem "Service Bus Queue: sandboxes-service-connection-audit-log (Azure)" "Subscriber-owned Service Bus queue. Receives Connection audit log events via Event Grid." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-sandboxes-service-connection-audit-log = softwareSystem "Pub/Sub Sub: sandboxes-service-connection-audit-log (GCP)" "Subscriber-owned Pub/Sub subscription. Receives Connection audit log events." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    # --- KAI Assistant apps (ai-chat, kai-assistant, kai-agent) ---
    # All three apps use the same Terraform module (app-ai-chat) with different namespace values.

    postgresql-instance = softwareSystem "PostgreSQL" "Shared PostgreSQL instance. Hosts databases for: kai-assistant (ai_chat, kai_assistant, kai_agent), query-service (query_service), metastore (metastore_service). Provisioned by rds_postgresql.tf. Hosted on the cloud-specific managed service per stack (AWS RDS / Azure Database for PostgreSQL / Cloud SQL); see Architecture-wide conventions for why no provider tag." {
        tags "CloudResource" "PostgreSQL"
    }

    s3-bucket-ai-chat-storage = softwareSystem "S3 Bucket: kai-app-storage (AWS)" "Per-app S3 buckets for KAI app file storage. One bucket per app namespace (ai-chat, kai-assistant, kai-agent)." {
        tags "CloudResource" "S3" "AWS"
    }
    abs-ai-chat-storage = softwareSystem "Azure Blob Storage: kai-app-storage (Azure)" "Per-app Azure Blob Storage accounts for KAI app file storage." {
        tags "CloudResource" "ABS" "Azure"
    }
    gcs-ai-chat-storage = softwareSystem "GCS Bucket: kai-app-storage (GCP)" "Per-app GCS buckets for KAI app file storage." {
        tags "CloudResource" "GCS" "GCP"
    }

    # --- Connection internal queues ---
    # main and commands: Pattern A (Connection publishes directly to SQS/Service Bus/Pub/Sub).
    # events-elastic, audit-log-events, table-triggers, search-index: Pattern B subscriber queues
    #   fanned out from the corresponding fan-out topic (see Cross-service fan-out topics below).

    sqs-queue-connection-main = softwareSystem "SQS Queue: connection-main (AWS)" "Connection internal main queue. Pattern A: connection publishes; connection-worker-main consumes." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-connection-main = softwareSystem "Service Bus Queue: connection-main (Azure)" "Connection internal main queue. Pattern A: connection publishes; connection-worker-main consumes." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-topic-connection-main = softwareSystem "Pub/Sub Topic: connection-main (GCP)" "Connection internal main queue. Pattern A: connection publishes; connection-worker-main consumes." {
        tags "CloudResource" "PubSub" "GCP"
    }

    sqs-queue-connection-commands = softwareSystem "SQS Queue: connection-commands (AWS)" "Connection internal commands queue. Pattern A: connection publishes; connection-worker-commands consumes." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-connection-commands = softwareSystem "Service Bus Queue: connection-commands (Azure)" "Connection internal commands queue. Pattern A: connection publishes; connection-worker-commands consumes." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-topic-connection-commands = softwareSystem "Pub/Sub Topic: connection-commands (GCP)" "Connection internal commands queue. Pattern A: connection publishes; connection-worker-commands consumes." {
        tags "CloudResource" "PubSub" "GCP"
    }

    sqs-queue-connection-events-elastic = softwareSystem "SQS Queue: connection-events-elastic (AWS)" "Connection-owned subscriber queue subscribed to sns-topic-connection-events. connection-worker-events-elastic consumes and feeds events into Elasticsearch." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-connection-events-elastic = softwareSystem "Service Bus Queue: connection-events-elastic (Azure)" "Connection-owned subscriber queue subscribed to eventgrid-topic-connection-events. connection-worker-events-elastic consumes and feeds events into Elasticsearch." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-connection-events-elastic = softwareSystem "Pub/Sub Sub: connection-events-elastic (GCP)" "Connection-owned subscription on pubsub-topic-connection-events. connection-worker-events-elastic consumes and feeds events into Elasticsearch." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    sqs-queue-connection-audit-log-events = softwareSystem "SQS Queue: connection-audit-log-events (AWS)" "Connection-owned subscriber queue subscribed to sns-topic-connection-audit-log. connection-worker-audit-log consumes. AWS resource: QueueAuditLogEvents." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-connection-audit-log-events = softwareSystem "Service Bus Queue: connection-audit-log-events (Azure)" "Connection-owned subscriber queue subscribed to eventgrid-topic-connection-audit-log. connection-worker-audit-log consumes." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-connection-audit-log-events = softwareSystem "Pub/Sub Sub: connection-audit-log-events (GCP)" "Connection-owned subscription on pubsub-topic-connection-audit-log. connection-worker-audit-log consumes." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    sqs-queue-connection-table-triggers = softwareSystem "SQS Queue: connection-table-triggers (AWS)" "Connection-owned subscriber queue subscribed to sns-topic-connection-events with filter eventName=storage.tableImportDone. connection-worker-triggers consumes." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-connection-table-triggers = softwareSystem "Service Bus Queue: connection-table-triggers (Azure)" "Connection-owned subscriber queue subscribed to eventgrid-topic-connection-events with included_event_types=storage.tableImportDone. connection-worker-triggers consumes." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-connection-table-triggers = softwareSystem "Pub/Sub Sub: connection-table-triggers (GCP)" "Connection-owned subscription on pubsub-topic-connection-events filtered to storage.tableImportDone. connection-worker-triggers consumes." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    sqs-queue-connection-search-index = softwareSystem "SQS Queue: connection-search-index (AWS)" "Connection-owned subscriber queue subscribed to sns-topic-connection-search-index. connection-worker-search-index consumes." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-connection-search-index = softwareSystem "Service Bus Queue: connection-search-index (Azure)" "Connection-owned subscriber queue subscribed to eventgrid-topic-connection-search-index. connection-worker-search-index consumes." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-connection-search-index = softwareSystem "Pub/Sub Sub: connection-search-index (GCP)" "Connection-owned subscription on pubsub-topic-connection-search-index. connection-worker-search-index consumes." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    # --- Fan-out topics (Connection publishes; subscribers consume via owned queues) ---
    # Subscribers include both Connection's own internal worker queues and cross-service queues
    # owned by editor, vault, oauth, sandboxes-service.

    sns-topic-connection-events = softwareSystem "SNS Topic: connection-events (AWS)" "Fan-out topic. Connection publishes project/workspace lifecycle events. Subscribers: connection (events-elastic, table-triggers), editor, vault, oauth, sandboxes-service." {
        tags "CloudResource" "SNS" "AWS"
    }
    eventgrid-topic-connection-events = softwareSystem "Event Grid Topic: connection-events (Azure)" "Fan-out topic for connection events. Subscribers: connection (events-elastic, table-triggers), editor, vault, oauth, sandboxes-service." {
        tags "CloudResource" "EventGrid" "Azure"
    }
    pubsub-topic-connection-events = softwareSystem "Pub/Sub Topic: connection-events (GCP)" "Fan-out topic for connection events. Subscribers: connection (events-elastic, table-triggers), editor, vault, oauth, sandboxes-service." {
        tags "CloudResource" "PubSub" "GCP"
    }

    sns-topic-connection-audit-log = softwareSystem "SNS Topic: connection-audit-log (AWS)" "Fan-out topic. Connection publishes audit log events. Subscribers: connection (audit-log-events), editor, sandboxes-service." {
        tags "CloudResource" "SNS" "AWS"
    }
    eventgrid-topic-connection-audit-log = softwareSystem "Event Grid Topic: connection-audit-log (Azure)" "Fan-out topic for connection audit log events. Subscribers: connection (audit-log-events), editor, sandboxes-service." {
        tags "CloudResource" "EventGrid" "Azure"
    }
    pubsub-topic-connection-audit-log = softwareSystem "Pub/Sub Topic: connection-audit-log (GCP)" "Fan-out topic for connection audit log events. Subscribers: connection (audit-log-events), editor, sandboxes-service." {
        tags "CloudResource" "PubSub" "GCP"
    }

    sns-topic-connection-search-index = softwareSystem "SNS Topic: connection-search-index (AWS)" "Fan-out topic for global search index updates. Subscriber: connection (search-index queue) only -- topic ARN is not exposed as a module output." {
        tags "CloudResource" "SNS" "AWS"
    }
    eventgrid-topic-connection-search-index = softwareSystem "Event Grid Topic: connection-search-index (Azure)" "Fan-out topic for global search index updates. Subscriber: connection (search-index queue) only." {
        tags "CloudResource" "EventGrid" "Azure"
    }
    pubsub-topic-connection-search-index = softwareSystem "Pub/Sub Topic: connection-search-index (GCP)" "Fan-out topic for global search index updates. Subscriber: connection (search-index queue) only." {
        tags "CloudResource" "PubSub" "GCP"
    }

    # --- editor-service internal session queue (Pattern A) ---
    # Per-cloud names differ. Resources defined in modules/app-editor-service/{aws,azure,gcp}/queue.tf.

    sqs-queue-editor-service-sessions = softwareSystem "SQS Queue: editor-service-sessions (AWS)" "Editor-owned internal queue. Pattern A: editor-api publishes ProcessSessionMessage; editor-session-worker consumes. TF resource: aws_sqs_queue.editor_service_sessions, name 'kbc-editor-service-sessions' (modules/app-editor-service/aws/queue.tf)." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-editor-service-sessions = softwareSystem "Service Bus Queue: session-transition (Azure)" "Editor-owned internal queue. Pattern A: editor-api publishes ProcessSessionMessage; editor-session-worker consumes. TF resource: azurerm_servicebus_queue.editor_service_sessions, queue name 'session-transition' inside dedicated Service Bus namespace 'editor-service-<md5(rg)>' (modules/app-editor-service/azure/queue.tf)." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-topic-editor-service-sessions = softwareSystem "Pub/Sub Topic: editor-service-session-workers (GCP)" "Editor-owned internal topic. Pattern A: editor-api publishes ProcessSessionMessage; editor-session-worker consumes a same-named subscription. TF resource: google_pubsub_topic.editor_service_sessions, topic name 'editor-service-<keboola_stack>-session-workers' with same-named subscription (modules/app-editor-service/gcp/queue.tf)." {
        tags "CloudResource" "PubSub" "GCP"
    }

    # --- Subscriber-owned queues: editor-service (Pattern B) ---
    # Per-cloud names differ. Resources defined in modules/app-editor-service/{aws,azure,gcp}/queue_connection.tf.

    sqs-queue-editor-service-connection-events = softwareSystem "SQS Queue: editor-service-connection-events (AWS)" "Editor-owned subscriber queue for Connection events. TF resource: aws_sqs_queue.connection_events, name 'kbc-editor-service-connection-events' (modules/app-editor-service/aws/queue_connection.tf)." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-editor-service-connection-events = softwareSystem "Service Bus Queue: connection-events (Azure)" "Editor-owned subscriber queue for Connection events. TF resource: azurerm_servicebus_queue.connection_events, queue name 'connection-events' inside dedicated Service Bus namespace 'editor-service-<md5(rg)>' (modules/app-editor-service/azure/queue_connection.tf)." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-editor-service-connection-events = softwareSystem "Pub/Sub Sub: editor-service-events-subscription (GCP)" "Editor-owned subscriber subscription for Connection events. TF resource: google_pubsub_subscription.connection_events, name 'editor-servicee-<keboola_stack>-events-subscription' (typo: literal extra 'e' from '${local.app_name}e-' in queue_connection.tf line 21). Subscribes to Connection's pubsub-topic-connection-events." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    sqs-queue-editor-service-connection-audit-log = softwareSystem "SQS Queue: editor-service-connection-audit-log (AWS)" "Editor-owned subscriber queue for Connection audit log events. TF resource: aws_sqs_queue.connection_audit_log_events, name 'kbc-editor-service-connection-audit-log' (modules/app-editor-service/aws/queue_connection.tf)." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-editor-service-connection-audit-log = softwareSystem "Service Bus Queue: connection-audit-log (Azure)" "Editor-owned subscriber queue for Connection audit log events. TF resource: azurerm_servicebus_queue.connection_audit_log, queue name 'connection-audit-log' inside dedicated Service Bus namespace 'editor-service-<md5(rg)>' (modules/app-editor-service/azure/queue_connection.tf)." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-editor-service-connection-audit-log = softwareSystem "Pub/Sub Sub: editor-service-audit-log-subscription (GCP)" "Editor-owned subscriber subscription for Connection audit log events. TF resource: google_pubsub_subscription.connection_audit_log_events, name 'editor-service-<keboola_stack>-audit-log-subscription'. Subscribes to Connection's pubsub-topic-connection-audit-log." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    # --- Subscriber-owned queues: vault (Pattern B) ---

    sqs-queue-vault-connection-events = softwareSystem "SQS Queue: vault-connection-events (AWS)" "Vault-owned subscriber queue for Connection events." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-vault-connection-events = softwareSystem "Service Bus Queue: vault-connection-events (Azure)" "Vault-owned subscriber queue for Connection events." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-vault-connection-events = softwareSystem "Pub/Sub Sub: vault-connection-events (GCP)" "Vault-owned subscriber subscription for Connection events." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    # --- Subscriber-owned queues: oauth-service (Pattern B) ---

    sqs-queue-oauth-connection-events = softwareSystem "SQS Queue: oauth-connection-events (AWS)" "OAuth-owned subscriber queue for Connection events." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-oauth-connection-events = softwareSystem "Service Bus Queue: oauth-connection-events (Azure)" "OAuth-owned subscriber queue for Connection events." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-sub-oauth-connection-events = softwareSystem "Pub/Sub Sub: oauth-connection-events (GCP)" "OAuth-owned subscriber subscription for Connection events." {
        tags "CloudResource" "PubSub" "GCP" "Queue"
    }

    # --- Daemon job queues (Pattern A) ---

    sqs-queue-daemon-jobs-to-start = softwareSystem "SQS Queue: daemon-jobs-to-start (AWS)" "Daemon-owned queue for job startup messages. daemon-run publishes; daemon-start consumes." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-daemon-jobs-to-start = softwareSystem "Service Bus Queue: daemon-jobs-to-start (Azure)" "Daemon-owned queue for job startup messages. daemon-run publishes; daemon-start consumes." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-topic-daemon-jobs-to-start = softwareSystem "Pub/Sub Topic: daemon-jobs-to-start (GCP)" "Daemon-owned queue for job startup messages. daemon-run publishes; daemon-start consumes." {
        tags "CloudResource" "PubSub" "GCP"
    }

    sqs-queue-daemon-flow-jobs-transition = softwareSystem "SQS Queue: daemon-flow-jobs-transition (AWS)" "Daemon-owned queue for flow job state transitions. daemon-run publishes; daemon-flow-transition consumes." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-daemon-flow-jobs-transition = softwareSystem "Service Bus Queue: daemon-flow-jobs-transition (Azure)" "Daemon-owned queue for flow job state transitions. daemon-run publishes; daemon-flow-transition consumes." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-topic-daemon-flow-jobs-transition = softwareSystem "Pub/Sub Topic: daemon-flow-jobs-transition (GCP)" "Daemon-owned queue for flow job state transitions. daemon-run publishes; daemon-flow-transition consumes." {
        tags "CloudResource" "PubSub" "GCP"
    }

    # --- Notification queues (Pattern A) ---

    sqs-queue-notification-messages = softwareSystem "SQS Queue: notification-messages (AWS)" "Notification-owned internal queue. API publishes events; consumer delivers notifications." {
        tags "CloudResource" "SQS" "AWS"
    }
    servicebus-queue-notification-messages = softwareSystem "Service Bus Queue: notification-messages (Azure)" "Notification-owned internal queue. API publishes events; consumer delivers notifications." {
        tags "CloudResource" "ServiceBus" "Azure"
    }
    pubsub-topic-notification-messages = softwareSystem "Pub/Sub Topic: notification-messages (GCP)" "Notification-owned internal queue. API publishes events; consumer delivers notifications." {
        tags "CloudResource" "PubSub" "GCP"
    }

    # --- AI service resources ---

    azure-openai-ai-service = softwareSystem "Azure OpenAI: ai-service" "Azure OpenAI deployment used by ai-service for LLM inference and embeddings." {
        tags "CloudResource" "OpenAI" "AI" "Azure"
    }

    storage-ai-vectorstore-aws = softwareSystem "S3 Bucket: ai-vectorstore (AWS)" "AI service S3 bucket for vector store index data." {
        tags "CloudResource" "S3" "AWS"
    }
    storage-ai-vectorstore-azure = softwareSystem "Azure Blob: ai-vectorstore (Azure)" "AI service Azure Blob Storage for vector store index data." {
        tags "CloudResource" "ABS" "Azure"
    }
    storage-ai-vectorstore-gcp = softwareSystem "GCS Bucket: ai-vectorstore (GCP)" "AI service GCS bucket for vector store index data." {
        tags "CloudResource" "GCS" "GCP"
    }

    # --- Omnisearch resources ---

    storage-omnisearch-metastore-aws = softwareSystem "S3 Bucket: omnisearch-metastore (AWS)" "Omnisearch S3 bucket for metastore index data." {
        tags "CloudResource" "S3" "AWS"
    }
    storage-omnisearch-metastore-azure = softwareSystem "Azure Blob: omnisearch-metastore (Azure)" "Omnisearch Azure Blob Storage for metastore index data." {
        tags "CloudResource" "ABS" "Azure"
    }
    storage-omnisearch-metastore-gcp = softwareSystem "GCS Bucket: omnisearch-metastore (GCP)" "Omnisearch GCS bucket for metastore index data." {
        tags "CloudResource" "GCS" "GCP"
    }

    # --- Shared S3 logs bucket ---

    s3-bucket-logs = softwareSystem "S3 Bucket: logs (AWS)" "Shared S3 logs bucket. CFn: kbc-logs-bucket." {
        tags "CloudResource" "S3" "AWS"
    }

    # --- Stream etcd snapshots ---

    efs-stream-etcd-snapshots = softwareSystem "EFS: stream-etcd-snapshots (AWS)" "AWS EFS file system for stream etcd disaster recovery snapshots. NFS mount targets in each subnet, mounted into EKS pods." {
        tags "CloudResource" "EFS" "AWS"
    }
    abs-stream-etcd-snapshots = softwareSystem "ABS: stream-etcd-snapshots (Azure)" "Azure Blob Storage account for stream etcd disaster recovery snapshots." {
        tags "CloudResource" "ABS" "Azure"
    }
    gcs-stream-etcd-snapshots = softwareSystem "GCS Bucket: stream-etcd-snapshots (GCP)" "GCP GCS bucket for stream etcd disaster recovery snapshots." {
        tags "CloudResource" "GCS" "GCP"
    }

    # --- Cloud LLM providers (KAI Assistant) ---

    google-vertex-ai = softwareSystem "Google Vertex AI" "Google Vertex AI managed LLM platform. Used by KAI apps on AWS and GCP stacks via Vertex Anthropic API." {
        tags "CloudResource" "AI" "GCP"
    }
    azure-ai-foundry = softwareSystem "Azure AI Foundry" "Azure AI Foundry managed LLM platform. Used by KAI apps on Azure stacks." {
        tags "CloudResource" "AI" "Azure"
    }

    # --- E2B (Vendor) ---

    e2b = softwareSystem "E2B" "Sandboxed code execution platform. Used by kai-agent to run Python/JS code in isolated sandboxes." {
        tags "Vendor"
    }
