views {

    # -------------------------------------------------------------------------
    # L1 -- System Context
    # -------------------------------------------------------------------------

    systemContext keboolaPlatform "L1-SystemContext" "System context view of the Keboola platform and its satellite systems." {
        include keboolaPlatform
        include dataEngineer
        include dataAnalyst
        include developer
        include endUser
        include developerPortal
        include telemetry
        include aws
        include azure
        include gcp
        include datadog
        include github
        include snowflake
        include bigquery
        include synapse
        include exasol
        include supabase
        include sendgrid
        include stripe
        include azure-marketplace
        include google-marketplace
        include e2b
        autoLayout
    }

    # -------------------------------------------------------------------------
    # L2 -- Container views
    # -------------------------------------------------------------------------

    container keboolaPlatform "L2-KeboolaPlatform" "Container view of the Keboola Platform." {
        include *
        exclude "element.tag==Vendor"
        exclude "element.tag==CloudResource"
        autoLayout
    }

    container developerPortal "L2-DeveloperPortal" "Container view of the Developer Portal satellite system." {
        include *
        autoLayout
    }

    container telemetry "L2-Telemetry" "Container view of the Telemetry satellite system." {
        include *
        autoLayout
    }

    # -------------------------------------------------------------------------
    # L2 -- Cloud Resources (per provider)
    # -------------------------------------------------------------------------

    container keboolaPlatform "L2-CloudResources-AWS" "AWS cloud resources used by the Keboola Platform." {
        title "Container View: Keboola Platform - AWS Cloud Resources"
        include *
        exclude "element.tag==Azure"
        exclude "element.tag==GCP"
        exclude "element.tag==Vendor"
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    container keboolaPlatform "L2-CloudResources-Azure" "Azure cloud resources used by the Keboola Platform." {
        title "Container View: Keboola Platform - Azure Cloud Resources"
        include *
        exclude "element.tag==AWS"
        exclude "element.tag==GCP"
        exclude "element.tag==Vendor"
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    container keboolaPlatform "L2-CloudResources-GCP" "GCP cloud resources used by the Keboola Platform." {
        title "Container View: Keboola Platform - GCP Cloud Resources"
        include *
        exclude "element.tag==AWS"
        exclude "element.tag==Azure"
        exclude "element.tag==Vendor"
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    # -------------------------------------------------------------------------
    # L3 -- Component views
    # -------------------------------------------------------------------------

    component ai "L3-AI" "Component view of the AI container." {
        include *
        include azure-openai-ai-service
        include mysql-instance-job-queue
        include kms-key-ai-aws
        include kms-key-ai-azure
        include kms-key-ai-gcp
        include storage-ai-vectorstore-aws
        include storage-ai-vectorstore-azure
        include storage-ai-vectorstore-gcp
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component editor "L3-Editor" "Component view of the Editor container." {
        include *
        include mysql-instance-job-queue
        include kms-key-editor-aws
        include kms-key-editor-azure
        include kms-key-editor-gcp
        include sqs-queue-editor-service-sessions
        include servicebus-queue-editor-service-sessions
        include pubsub-topic-editor-service-sessions
        include sqs-queue-editor-service-connection-events
        include servicebus-queue-editor-service-connection-events
        include pubsub-sub-editor-service-connection-events
        include sqs-queue-editor-service-connection-audit-log
        include servicebus-queue-editor-service-connection-audit-log
        include pubsub-sub-editor-service-connection-audit-log
        include sns-topic-connection-events
        include eventgrid-topic-connection-events
        include pubsub-topic-connection-events
        include sns-topic-connection-audit-log
        include eventgrid-topic-connection-audit-log
        include pubsub-topic-connection-audit-log
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component sync-actions "L3-SyncActions" "Component view of the Sync Actions container." {
        include *
        include kms-key-job-runner-aws
        include kms-key-job-runner-azure
        include kms-key-job-runner-gcp
        include s3-bucket-logs
        include aws-eks
        include azure-aks
        include gcp-gke
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component scheduler "L3-Scheduler" "Component view of the Scheduler container." {
        include *
        include mysql-instance-job-queue
        include kms-key-scheduler-aws
        include kms-key-scheduler-azure
        include kms-key-scheduler-gcp
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component queue "L3-Queue" "Component view of the Queue container (includes daemon group)." {
        include *
        include mysql-instance-job-queue
        include kms-key-job-runner-aws
        include kms-key-job-runner-azure
        include kms-key-job-runner-gcp
        include sqs-queue-daemon-jobs-to-start
        include servicebus-queue-daemon-jobs-to-start
        include pubsub-topic-daemon-jobs-to-start
        include sqs-queue-daemon-flow-jobs-transition
        include servicebus-queue-daemon-flow-jobs-transition
        include pubsub-topic-daemon-flow-jobs-transition
        include aws-eks
        include azure-aks
        include gcp-gke
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    component encryption "L3-Encryption" "Component view of the Encryption container." {
        include *
        include kms-key-job-runner-aws
        include kms-key-job-runner-azure
        include kms-key-job-runner-gcp
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component omnisearch "L3-Omnisearch" "Component view of the Omnisearch container." {
        include *
        include azure-openai-ai-service
        include storage-omnisearch-metastore-aws
        include storage-omnisearch-metastore-azure
        include storage-omnisearch-metastore-gcp
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component vault "L3-Vault" "Component view of the Vault container." {
        include *
        include mysql-instance-job-queue
        include sqs-queue-vault-connection-events
        include servicebus-queue-vault-connection-events
        include pubsub-sub-vault-connection-events
        include sns-topic-connection-events
        include eventgrid-topic-connection-events
        include pubsub-topic-connection-events
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component connection "L3-Connection" "Component view of the Connection container." {
        include *
        include mysql-instance-connection
        include sqs-queue-connection-main
        include servicebus-queue-connection-main
        include pubsub-topic-connection-main
        include sqs-queue-connection-commands
        include servicebus-queue-connection-commands
        include pubsub-topic-connection-commands
        include sqs-queue-connection-events-elastic
        include servicebus-queue-connection-events-elastic
        include pubsub-sub-connection-events-elastic
        include sqs-queue-connection-audit-log-events
        include servicebus-queue-connection-audit-log-events
        include pubsub-sub-connection-audit-log-events
        include sqs-queue-connection-table-triggers
        include servicebus-queue-connection-table-triggers
        include pubsub-sub-connection-table-triggers
        include sqs-queue-connection-search-index
        include servicebus-queue-connection-search-index
        include pubsub-sub-connection-search-index
        include sns-topic-connection-events
        include eventgrid-topic-connection-events
        include pubsub-topic-connection-events
        include sns-topic-connection-audit-log
        include eventgrid-topic-connection-audit-log
        include pubsub-topic-connection-audit-log
        include sns-topic-connection-search-index
        include eventgrid-topic-connection-search-index
        include pubsub-topic-connection-search-index
        include s3-bucket-logs
        include sendgrid
        include stripe
        include snowflake
        include bigquery
        include aws-eks
        include azure-aks
        include gcp-gke
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    component billing "L3-Billing" "Component view of the Billing container." {
        include *
        include mysql-instance-job-queue
        include azure-marketplace
        include google-marketplace
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    component notification "L3-Notification" "Component view of the Notification container." {
        include *
        include mysql-instance-job-queue
        include sqs-queue-notification-messages
        include servicebus-queue-notification-messages
        include pubsub-topic-notification-messages
        include sendgrid
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    component import "L3-Import" "Component view of the Import container." {
        include *
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component oauth "L3-OAuth" "Component view of the OAuth container." {
        include *
        include mysql-instance-job-queue
        include kms-key-oauth-aws
        include kms-key-oauth-azure
        include kms-key-oauth-gcp
        include sqs-queue-oauth-connection-events
        include servicebus-queue-oauth-connection-events
        include pubsub-sub-oauth-connection-events
        include sns-topic-connection-events
        include eventgrid-topic-connection-events
        include pubsub-topic-connection-events
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component mcp-server "L3-MCPServer" "Component view of the MCP Server container." {
        include *
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component templates "L3-Templates" "Component view of the Templates container." {
        include *
        include github
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    component kai-assistant "L3-KAIAssistant" "Component view of the KAI Assistant container." {
        include *
        include postgresql-instance
        include s3-bucket-ai-chat-storage
        include abs-ai-chat-storage
        include gcs-ai-chat-storage
        include kms-key-ai-chat-gcp
        include google-vertex-ai
        include azure-ai-foundry
        include e2b
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    component query "L3-Query" "Component view of the Query container." {
        include *
        include postgresql-instance
        include snowflake
        include bigquery
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    component sandboxes "L3-Sandboxes" "Component view of the Sandboxes container." {
        include *
        include mysql-instance-job-queue
        include kms-key-job-runner-aws
        include kms-key-job-runner-azure
        include kms-key-job-runner-gcp
        include kms-key-sandboxes-service-aws
        include kms-key-sandboxes-service-azure
        include kms-key-sandboxes-service-gcp
        include sqs-queue-sandboxes-service-connection-events
        include servicebus-queue-sandboxes-service-connection-events
        include pubsub-sub-sandboxes-service-connection-events
        include sqs-queue-sandboxes-service-connection-audit-log
        include servicebus-queue-sandboxes-service-connection-audit-log
        include pubsub-sub-sandboxes-service-connection-audit-log
        include sns-topic-connection-events
        include eventgrid-topic-connection-events
        include pubsub-topic-connection-events
        include sns-topic-connection-audit-log
        include eventgrid-topic-connection-audit-log
        include pubsub-topic-connection-audit-log
        include aws-eks
        include azure-aks
        include gcp-gke
        include e2b
        exclude "element.tag==CloudProvider"
        autoLayout
    }

    component metastore "L3-Metastore" "Component view of the Metastore container." {
        include *
        include postgresql-instance
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    component git-service "L3-GitService" "Component view of the Git Service container." {
        include *
        exclude "element.tag==CloudProvider"
        exclude "element.tag==CloudResource"
        autoLayout
    }

    component api "L3-APIPortal" "Component view of the API Portal container." {
        include *
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        exclude "element.tag==CloudResource"
        autoLayout
    }

    component stream "L3-Stream" "Component view of the Stream container." {
        include *
        include kms-key-stream-aws
        include kms-key-stream-azure
        include kms-key-stream-gcp
        include efs-stream-etcd-snapshots
        include abs-stream-etcd-snapshots
        include gcs-stream-etcd-snapshots
        exclude "element.tag==CloudProvider"
        exclude "element.tag==Vendor"
        autoLayout
    }

    # -------------------------------------------------------------------------
    # Styles
    # -------------------------------------------------------------------------

    styles {
        # --- C4 base ---
        element "Person" {
            shape Person
            background #1168bd
            color #ffffff
        }
        element "Software System" {
            background #1168bd
            color #ffffff
        }
        element "Container" {
            background #438dd5
            color #ffffff
        }
        element "Component" {
            background #85bbf0
            color #000000
        }

        # --- Lifecycle (apply to own containers/components) ---
        element "Legacy" {
            background #cccccc
            color #666666
            border dashed
        }
        element "Uncommissioned" {
            background #f5e6c8
            color #8a6000
            border dashed
        }

        # --- Infrastructure ---
        element "SelfHosted" {
            background #444444
            color #ffffff
        }

        # --- External vendors ---
        element "Vendor" {
            background #1a5c33
            color #ffffff
        }

        # --- Cloud resources: generic fallback (any CloudResource without a more specific type) ---
        element "CloudResource" {
            background #0d6e6e
            color #ffffff
        }

        # ---------------------------------------------------------------------
        # Cloud resources: BODY COLOR encodes resource TYPE.
        # Order matters: more specific styles must come AFTER more general ones.
        # ---------------------------------------------------------------------

        # Database (slate blue)
        element "MySQL" {
            background #4a6fa5
            color #ffffff
        }
        element "PostgreSQL" {
            background #4a6fa5
            color #ffffff
        }

        # Key management (brown)
        element "KMS" {
            background #6d4c41
            color #ffffff
        }
        element "KeyVault" {
            background #6d4c41
            color #ffffff
        }

        # Topic / fan-out (rose). PubSub topics fall here; PubSub subscriptions
        # carry an additional "Queue" tag and are recolored below.
        element "SNS" {
            background #b91c5c
            color #ffffff
        }
        element "EventGrid" {
            background #b91c5c
            color #ffffff
        }
        element "PubSub" {
            background #b91c5c
            color #ffffff
        }

        # Queue / point-to-point (amber). Queue tag overrides PubSub for subscriptions.
        element "SQS" {
            background #d97706
            color #ffffff
        }
        element "ServiceBus" {
            background #d97706
            color #ffffff
        }
        element "Queue" {
            background #d97706
            color #ffffff
        }

        # Object / file storage (forest green)
        element "S3" {
            background #2e7d32
            color #ffffff
        }
        element "ABS" {
            background #2e7d32
            color #ffffff
        }
        element "GCS" {
            background #2e7d32
            color #ffffff
        }
        element "EFS" {
            background #2e7d32
            color #ffffff
        }

        # AI services (purple). Tag added to OpenAI, Vertex AI, AI Foundry.
        element "AI" {
            background #6a1b9a
            color #ffffff
        }

        # ---------------------------------------------------------------------
        # Cloud resources: BORDER COLOR encodes PROVIDER.
        # Stroke + strokeWidth do not collide with background, so type+provider
        # styles merge naturally on elements tagged with both.
        # ---------------------------------------------------------------------

        element "AWS" {
            stroke #ff9900
            strokeWidth 4
        }
        element "Azure" {
            stroke #0078d4
            strokeWidth 4
        }
        element "GCP" {
            stroke #ea4335
            strokeWidth 4
        }
    }

}
