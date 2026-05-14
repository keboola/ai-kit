    # -------------------------------------------------------------------------
    # Keboola Platform — L2 Containers
    # -------------------------------------------------------------------------

    # --- Core / Monolith ---

    connection = container "Connection" "Core platform monolith. Three APIs (Storage, Manage, PAYG) plus background workers. Manages projects, tokens, storage backends, configurations, events." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/connection"
        properties {
            "repos" "connection"
        }

        connection-storage-api = component "Storage API" "Zend-based REST API (/v1, /v2). Core data-plane: buckets, tables, files, tokens, events, workspaces, dev branches." "PHP" {
            tags "PHP"
        }
        connection-manage-api = component "Manage API" "Zend-based REST API (/manage). Org-level: projects, users, storage backends, maintainers." "PHP" {
            tags "PHP"
        }
        connection-payg-api = component "PAYG API" "Zend-based REST API (/pay-as-you-go). Pay-as-you-go billing: Stripe payments, credits, registration wizard." "PHP" {
            tags "PHP"
        }
        connection-worker-main = component "Worker: main" "Processes storage jobs from the main queue." "PHP" {
            tags "PHP"
        }
        connection-worker-commands = component "Worker: commands" "Processes CLI command messages (e.g. project purge)." "PHP" {
            tags "PHP"
        }
        connection-worker-audit-log = component "Worker: audit-log" "Writes audit log entries from the internal audit-log queue." "PHP" {
            tags "PHP"
        }
        connection-worker-events-elastic = component "Worker: events-elastic" "Reads events and indexes them into Elasticsearch." "PHP" {
            tags "PHP"
        }
        connection-worker-search-index = component "Worker: search-index" "Reads data and updates the global search index." "PHP" {
            tags "PHP"
        }
        connection-worker-triggers = component "Worker: triggers" "Consumes table trigger events and fires component jobs via Queue." "PHP" {
            tags "PHP"
        }
        connection-worker-user-tasks-scheduler = component "Worker: user-tasks-scheduler" "Reads ScheduledTask entities from MySQL and enqueues storage jobs at cron-expression times." "PHP" {
            tags "PHP"
        }
        connection-worker-monitoring = component "Worker: monitoring" "Tests live connections to customer Snowflake and BigQuery backends." "PHP" {
            tags "PHP"
        }
        connection-worker-certificate-rotation = component "Worker: certificate-rotation" "Reads/writes certificate records in MySQL, executes DDL on Snowflake, sends expiry warning emails." "PHP" {
            tags "PHP"
        }
        connection-publish-worker-metrics = component "Worker: publish-worker-metrics" "Publishes worker metrics." "PHP" {
            tags "PHP"
        }
        connection-cronjob-token-expiration = component "CronJob: token-expiration" "Deletes expired storage/manage tokens, invitations, sessions, and project-admin associations." "PHP" {
            tags "PHP"
        }
        connection-cronjob-project-purge-scheduler = component "CronJob: project-purge-scheduler" "Reads deleted projects and enqueues project-purge commands." "PHP" {
            tags "PHP"
        }
        connection-cronjob-sync-apps = component "CronJob: sync-apps" "Syncs UI app definitions from the reference Connection stack into the local database." "PHP" {
            tags "PHP"
        }
        connection-cronjob-sync-components = component "CronJob: sync-components" "Fetches component definitions from Developer Portal and writes them to the apis table." "PHP" {
            tags "PHP"
        }
        connection-cronjob-storage-jobs-table-partitioning = component "CronJob: storage-jobs-partitioning" "Manages bi_storage_jobs MySQL range partitions." "PHP" {
            tags "PHP"
        }
        connection-cronjob-global-search-table-partitioning = component "CronJob: global-search-partitioning" "Manages bi_gs_consistency MySQL range partitions." "PHP" {
            tags "PHP"
        }
        connection-cronjob-add-audit-log-partition = component "CronJob: audit-log-partition" "Manages bi_auditLog MySQL range partitions." "PHP" {
            tags "PHP"
        }
        connection-cronjob-snapshot-project-metrics = component "CronJob: snapshot-project-metrics" "Snapshots per-project metrics." "PHP" {
            tags "PHP"
        }
        connection-cronjob-workers-expiration = component "CronJob: workers-expiration" "Expires stale workers." "PHP" {
            tags "PHP"
        }
        connection-cronjob-clear-expired-oauth-tokens = component "CronJob: clear-expired-oauth-tokens" "Clears expired OAuth 2 server tokens." "PHP" {
            tags "PHP"
        }
        connection-cronjob-release-staled-locks = component "CronJob: release-staled-locks" "Lists pods via Kubernetes API to release stale distributed locks." "PHP" {
            tags "PHP"
        }
        connection-cronjob-delete-events-indices = component "CronJob: delete-events-indices" "Monthly. Deletes old Elasticsearch events indices." "PHP" {
            tags "PHP"
        }
        connection-cronjob-roll-elastic-events-index = component "CronJob: roll-elastic-events-index" "Monthly. Rolls the active Elasticsearch events index." "PHP" {
            tags "PHP"
        }
    }

    # --- AI / ML ---

    ai = container "AI Service" "Handles AI-powered features: LLM responses, vector index management, prompt/feedback recording." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/ai-service"
        properties {
            "repos" "ai-service"
        }

        ai-api = component "AI API" "PHP REST API handling AI feature requests." "PHP" {
            tags "PHP"
        }
        ai-agent = component "KAI Bot Agent" "Python sidecar providing LLM agent capabilities. Communicates with AI API on localhost." "Python" {
            tags "Python"
        }
        ai-index-builder = component "AI Index Builder" "Daily CronJob. Runs Python agent to rebuild vector index from project data in Connection." "Python" {
            tags "Python"
        }
    }

    # --- Editor (SQL Editor / Workspace UI backend) ---

    editor = container "Editor" "Backend for the SQL Editor and persistent Workspace management. Handles workspace lifecycle, query execution, and notebook management." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/editor-service"
        properties {
            "repos" "editor-service"
        }

        editor-api = component "Editor API" "Symfony REST API. Manages workspace sessions, SQL queries, notebooks." "PHP" {
            tags "PHP"
        }
        editor-consumer = component "Editor Consumer" "Symfony Messenger consumer (two instances). Subscribes to connection-events and connection-audit-log topics from Connection." "PHP" {
            tags "PHP"
        }
        editor-session-worker = component "Editor Session Worker" "Symfony Messenger consumer. Polls workspace jobs and manages workspace session lifecycle." "PHP" {
            tags "PHP"
        }
    }

    # --- Sync Actions (runner-sync-api) ---

    sync-actions = container "Sync Actions" "Executes component sync actions (e.g. test connection, get buckets). Short-lived synchronous job execution." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/runner-sync-api"
        properties {
            "repos" "runner-sync-api"
        }

        sync-actions-api = component "Sync Actions API" "REST API. Accepts sync action requests, spawns ephemeral containers via Kubernetes, returns results." "PHP" {
            tags "PHP"
        }
    }

    # --- Scheduler ---

    scheduler = container "Scheduler" "Manages scheduled component job execution. Triggers jobs based on cron schedules or event rules." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/scheduler"
        properties {
            "repos" "scheduler"
        }

        scheduler-api = component "Scheduler API" "Symfony REST API. Manages schedule definitions." "PHP" {
            tags "PHP"
        }
        scheduler-cron = component "Scheduler CronJob" "Runs every minute. Evaluates due schedules and enqueues component jobs via Queue API." "PHP" {
            tags "PHP"
        }
    }

    # --- Queue ---

    queue = container "Queue" "Manages component job lifecycle (create, run, monitor, complete). Includes public API, internal API, daemon, and ephemeral job runner." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/job-queue"
        properties {
            "repos" "job-queue, job-queue-daemon, job-runner"
        }

        queue-public-api = component "Queue Public API" "REST API for creating and querying component jobs." "PHP" {
            tags "PHP"
        }
        queue-internal-api = component "Queue Internal API" "Internal REST API used by daemon to update job state." "PHP" {
            tags "PHP"
        }
        queue-logstash = component "Queue Logstash" "Ships job records from MySQL to Elasticsearch for search." "Other" {
            tags "Other"
        }
        queue-cleanup = component "CronJob: cleanup" "Every 12h. Deletes job records for purged projects." "PHP" {
            tags "PHP"
        }
        queue-purge = component "CronJob: purge" "Every 3h. Purges old job records." "PHP" {
            tags "PHP"
        }
        queue-replication-check = component "CronJob: replication-check" "Every 15min. Verifies MySQL-to-Elasticsearch replication lag." "PHP" {
            tags "PHP"
        }
        queue-runner = component "Job Runner (service-container)" "Ephemeral per-job pod. Executes a single component job. Spawned by daemon, exits on completion." "PHP" {
            tags "PHP"
        }
        queue-gelf-logger = component "GELF Logger" "GELF log collector sidecar. Ships job logs to Connection Storage." "Other" {
            tags "Other"
        }
        queue-job-runner = component "Job Runner (legacy)" "Legacy monolithic job runner. Being replaced by service-container split." "PHP" {
            tags "PHP" "Legacy"
        }
        queue-daemon-run = component "Daemon: run" "Main daemon loop. Polls for new jobs, spawns runner pods via Kubernetes API." "PHP" {
            tags "PHP"
        }
        queue-daemon-start = component "Daemon: start" "Processes jobs-to-start messages. Handles job startup after pod is ready." "PHP" {
            tags "PHP"
        }
        queue-daemon-stop = component "Daemon: stop" "Handles graceful job stopping." "PHP" {
            tags "PHP"
        }
        queue-daemon-flow-transition = component "Daemon: flow-transition" "Processes flow job state transitions." "PHP" {
            tags "PHP"
        }
        daemon-cron-pod-cleanup = component "Daemon CronJob: pod-cleanup" "Every 10min. Cleans up orphaned K8s pods via Kubernetes API." "PHP" {
            tags "PHP"
        }
        daemon-cron-db-cleanup = component "Daemon CronJob: db-cleanup" "Every hour. Cleans up stale DB records via internal API." "PHP" {
            tags "PHP"
        }
        daemon-cron-flow-cleanup = component "Daemon CronJob: flow-cleanup" "Every 30min. Removes stale flow job data via internal API." "PHP" {
            tags "PHP"
        }
    }

    # --- Encryption ---

    encryption = container "Encryption" "Encrypts and decrypts configuration secrets using per-component KMS keys." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/encryption-api"
        properties {
            "repos" "encryption-api"
        }

        encryption-api = component "Encryption API" "REST API. Wraps Keboola ObjectEncryptor. Encrypts/decrypts arbitrary values using the shared job-runner KMS key." "PHP" {
            tags "PHP"
        }
    }

    # --- Omnisearch (serves at metastore.{suffix}) ---

    omnisearch = container "Omnisearch" "Provides platform-wide search across configurations, transformations, and metadata. Serves at metastore.{suffix}." "Python" {
        tags "Python"
        url "https://github.com/keboola/omnisearch-and-metadata-engine"
        properties {
            "repos" "omnisearch-and-metadata-engine"
        }

        omnisearch-service-api = component "Omnisearch API" "REST API. Queries the metastore index for configurations and transformations." "Python" {
            tags "Python"
        }
        omnisearch-metastore-builder = component "Metastore Builder" "Background worker. Builds and updates the metastore index from Storage and Queue data." "Python" {
            tags "Python"
        }
    }

    # --- Vault ---

    vault = container "Vault" "Stores and manages shared variables and secrets (user-defined key-value pairs accessible across jobs)." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/vault"
        properties {
            "repos" "vault"
        }

        vault-api = component "Vault API" "Symfony REST API. CRUD for variables. Records audit events to Connection." "PHP" {
            tags "PHP"
        }
        vault-messenger-consumer-connection-events = component "Connection Events Consumer" "Symfony Messenger consumer. Receives devBranchDeleted events and purges associated branch variables." "PHP" {
            tags "PHP"
        }
    }

    # --- Billing ---

    billing = container "Billing" "Tracks per-project resource usage and calculates credits consumed. Integrates with cloud marketplaces for PAYG billing." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/billing-api"
        properties {
            "repos" "billing-api"
        }

        billing-api = component "Billing API" "Symfony REST API. Exposes usage and billing data, processes marketplace webhooks." "PHP" {
            tags "PHP"
        }
        billing-gcp-marketplace-consumer = component "GCP Marketplace Consumer" "Deployment (GCP stacks only). Processes Google Cloud Marketplace entitlement and account events via Pub/Sub." "PHP" {
            tags "PHP"
        }
        billing-marketplaces-reporting-azure = component "Azure Marketplace Reporter" "CronJob (Azure stacks only, every 20min). Reports hourly usage batches to Azure Marketplace Metering Service." "PHP" {
            tags "PHP"
        }
    }

    # --- Notification ---

    notification = container "Notification" "Sends user notifications (email, webhooks) for job completions, errors, and platform events." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/notification-service"
        properties {
            "repos" "notification-service"
        }

        notification-api = component "Notification API" "Symfony REST API. Accepts events, manages subscriptions, publishes onto internal queue." "PHP" {
            tags "PHP"
        }
        notification-messenger-consumer = component "Notification Consumer" "Symfony Messenger consumer. Matches events to subscriptions, delivers via SendGrid or webhook." "PHP" {
            tags "PHP"
        }
        notification-expired-subscription-pruning = component "CronJob: expired-subscription-pruning" "Every 10min. Soft-deletes expired project subscriptions." "PHP" {
            tags "PHP"
        }
    }

    # --- Import (sapi-importer) ---

    import = container "Import" "Handles large file imports into Keboola Storage. Manages sliced file uploads and table import orchestration." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/sapi-importer"
        properties {
            "repos" "sapi-importer"
        }

        sapi-importer-api = component "Import API" "REST API. Accepts file upload requests and imports them into Storage via the Storage API." "PHP" {
            tags "PHP"
        }
    }

    # --- OAuth ---

    oauth = container "OAuth" "Manages OAuth 2.0 credentials for third-party integrations. Stores and retrieves encrypted OAuth tokens on behalf of components." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/oauth-service"
        properties {
            "repos" "oauth-api, oauth-service, oauth-api-serverless"
        }

        oauth-service-api = component "OAuth API" "Symfony REST API. CRUD for OAuth credentials. Verifies tokens via Storage API." "PHP" {
            tags "PHP"
        }
        oauth-service-messenger-consumer-connection-events = component "Connection Events Consumer" "Symfony Messenger consumer. Receives devBranchDeleted events and purges associated OAuth sessions." "PHP" {
            tags "PHP"
        }
        oauth-service-session-expiration = component "CronJob: session-expiration" "Every 15min. Soft-expires old authentication sessions." "PHP" {
            tags "PHP"
        }
        oauth-serverless-proxy = component "Serverless Proxy" "Nginx sidecar routing requests to the legacy serverless OAuth implementation during transition." "Other" {
            tags "Other" "Legacy"
        }
    }

    # --- MCP Server ---

    mcp-server = container "MCP Server" "Model Context Protocol server. Exposes Keboola platform capabilities to AI agents (Cursor, Claude, Windsurf) and internally to kai-assistant." "Python" {
        tags "Python"
        url "https://github.com/keboola/mcp-server"
        properties {
            "repos" "mcp-server"
        }

        mcp-server-api = component "MCP Server" "Hosted MCP server (http-compat transport). Serves external AI agents via OAuth." "Python" {
            tags "Python"
        }
        mcp-server-agent = component "MCP Server Agent" "Internal MCP server (streamable-http transport). Serves kai-assistant. No OAuth -- caller passes Storage token directly." "Python" {
            tags "Python"
        }
    }

    # --- Templates ---

    templates = container "Templates" "Manages reusable pipeline templates. Reads template definitions from GitHub at runtime and applies them to create configurations in Keboola Storage." "Go" {
        tags "Go"
        url "https://github.com/keboola/keboola-as-code"
        properties {
            "repos" "keboola-as-code"
        }

        templates-api = component "Templates API" "Go REST API. Applies templates to create/update Keboola configurations. Reads template definitions from GitHub." "Go" {
            tags "Go"
        }
        templates-api-etcd = component "etcd" "Self-hosted etcd cluster (Bitnami sub-chart, 3 replicas). Provides write atomicity locking for template operations. Separate instance from stream-etcd." "Other" {
            tags "SelfHosted" "Other"
        }
    }

    # --- Stream ---

    stream = container "Stream" "Ingests small and frequent events into project storage." "Go" {
        tags "Go"
        url "https://github.com/keboola/keboola-as-code"
        properties {
            "repos" "keboola-as-code"
        }

        stream-api = component "Stream API" "Go REST API. Manages stream definitions (sources, sinks). Authenticates via Storage API." "Go" {
            tags "Go"
        }
        stream-http-source = component "HTTP Source" "High-throughput HTTP ingest endpoint. Accepts incoming data records from external producers." "Go" {
            tags "Go"
        }
        stream-storage-coordinator = component "Storage Coordinator" "Orchestrates the lifecycle of slices and files -- triggers uploads and imports into Keboola Storage." "Go" {
            tags "Go"
        }
        stream-storage-writer = component "Storage Writer" "Receives encoded data from http-source nodes over TCP/KCP, buffers to local disk volumes." "Go" {
            tags "Go"
        }
        stream-storage-reader = component "Storage Reader" "Reads locally buffered data and uploads to staging, then triggers import into Keboola Storage. Co-located with writer in one StatefulSet pod." "Go" {
            tags "Go"
        }
        stream-etcd = component "etcd" "Self-hosted etcd cluster (Bitnami sub-chart). Distributed coordination, cluster state machine, task locking, statistics sync. Separate instance from templates-api-etcd." "Other" {
            tags "SelfHosted" "Other"
        }
    }

    # --- KAI Assistant (three apps: ai-chat, kai-assistant, kai-agent) ---

    kai-assistant = container "KAI Assistant" "Three AI chat apps sharing the same Terraform module: ai-chat (read-only chat), kai-assistant (BFF backend), and kai-agent (agentic code executor). All call Connection, mcp-server-agent, and a cloud LLM (Vertex AI or Azure AI Foundry)." "TypeScript" {
        tags "TypeScript"
        url "https://github.com/keboola/ui"
        properties {
            "repos" "ai-chat, ui"
        }

        kai-app-ai-chat = component "AI Chat" "Next.js read-only chat app. Uses OAuth for authentication. Repo: keboola/ai-chat." "TypeScript" {
            tags "TypeScript"
        }
        kai-app-kai-assistant = component "KAI Assistant" "Next.js BFF backend for the KAI Assistant chat UI. Repo: keboola/ui (apps/kai-assistant-backend)." "TypeScript" {
            tags "TypeScript"
        }
        kai-app-kai-agent = component "KAI Agent" "Hono HTTP server. Agentic executor with sandboxed code execution via E2B. Repo: keboola/ui (apps/kai-agent)." "TypeScript" {
            tags "TypeScript"
        }
    }

    # --- API Portal ---

    api = container "API Portal" "Static React SPA serving OpenAPI documentation for all platform services. No runtime service dependencies -- specs are fetched from live services at build time and bundled as static files." "TypeScript" {
        tags "TypeScript"
        url "https://github.com/keboola/api-service"
        properties {
            "repos" "api-service"
        }

        api-portal = component "API Portal" "Vite/React SPA using RapiDoc. Serves pre-built OpenAPI specs for all platform services. Stack-aware: filters available services per hostname via config.json." "TypeScript" {
            tags "TypeScript"
        }
    }

    # --- Query ---

    query = container "Query" "Handles SQL query execution against Keboola Storage backends (Snowflake, BigQuery). Used by SQL Editor and other consumers." "Go" {
        tags "Go"
        url "https://github.com/keboola/go-monorepo"
        properties {
            "repos" "go-monorepo"
        }

        query-service-api = component "Query API" "Go REST API. Accepts query requests, creates jobs, returns results. Serves at query.{suffix}." "Go" {
            tags "Go"
        }
        query-service-coordinator = component "Query Coordinator" "Distributes jobs to workers, monitors worker heartbeats, manages session lifecycle." "Go" {
            tags "Go"
        }
        query-service-worker = component "Query Worker" "Executes SQL queries against Snowflake or BigQuery. Polls job queues from PostgreSQL." "Go" {
            tags "Go"
        }
        query-service-partition-maintenance = component "CronJob: partition-maintenance" "Daily. Manages PostgreSQL table partitions for job history tables." "Go" {
            tags "Go"
        }
    }

    # --- Sandboxes / Workspaces / Data Apps ---

    sandboxes = container "Sandboxes" "Manages Python/R Workspaces and Data Apps (Apps). Four sub-systems: sandboxes-service (PHP REST API), apps-proxy (Go reverse proxy for Apps), keboola-operator (Go K8s operator), and sandboxes component (ephemeral PHP job run via job-queue)." "PHP" {
        tags "PHP"
        url "https://github.com/keboola/sandboxes-service"
        properties {
            "repos" "sandboxes-service, keboola-as-code, keboola-operator, sandboxes"
        }

        sandboxes-service-api = component "Sandboxes Service API" "PHP/Symfony REST API (RoadRunner). Central API for Workspace and App lifecycle. Serves at data-science.{suffix}. Manages provisioning strategy selection (operator vs job-queue vs E2B)." "PHP" {
            tags "PHP"
        }
        sandboxes-service-garbage-collector = component "CronJob: garbage-collector" "Every 15min. Cleans up orphaned K8s pods, PVCs, and persistent storages." "PHP" {
            tags "PHP"
        }
        sandboxes-service-messenger-consumer-connection-events = component "Messenger Consumer: connection-events" "Symfony Messenger consumer. Receives project and workspace lifecycle events from Connection (Pattern B)." "PHP" {
            tags "PHP"
        }
        sandboxes-service-messenger-consumer-connection-audit-log = component "Messenger Consumer: connection-audit-log" "Symfony Messenger consumer. Receives audit log events from Connection (Pattern B)." "PHP" {
            tags "PHP"
        }
        sandboxes-service-sync-app-runs-watch = component "Sync App Runs Watch" "Deployment. Watches K8s AppRun CRDs and syncs their state back to the sandboxes-service database." "PHP" {
            tags "PHP"
        }
        sandboxes-service-suspend = component "CronJob: suspend" "Suspends idle sandboxes on schedule." "PHP" {
            tags "PHP"
        }
        sandboxes-service-purge-app-runs = component "CronJob: purge-app-runs" "Purges old app run records." "PHP" {
            tags "PHP"
        }
        sandboxes-service-prune-app-run-logs = component "CronJob: prune-app-run-logs" "Prunes old app run log entries." "PHP" {
            tags "PHP"
        }
        apps-proxy = component "Apps Proxy" "Go reverse proxy (keboola-as-code cmd/apps-proxy). Routes HTTP requests to App pods in K8s. Authenticates via sandboxes-service. Used for Apps only, not Sandboxes." "Go" {
            tags "Go"
        }
        keboola-operator = component "Keboola Operator" "Go Kubernetes operator (keboola-operator repo). Manages App, StorageToken, E2bSandbox CRDs. Standard provisioning path for Apps; phasing in for Sandboxes. Decrypts app configs using job-runner KMS key." "Go" {
            tags "Go"
        }
        sandboxes-component = component "Sandboxes Component" "Ephemeral PHP job pod run via job-queue (keboola/sandboxes repo, component ID: keboola.sandboxes). Standard provisioning path for Workspaces; legacy path for Apps. Directly manages K8s resources. Being phased out for Apps." "PHP" {
            tags "PHP" "Legacy"
        }
    }

    # --- CLI / UI ---

    cli = container "CLI" "Keboola CLI tool. Interacts with platform APIs for local development workflows." "Go" {
        tags "Go"
        url "https://github.com/keboola/keboola-as-code"
        properties {
            "repos" "keboola-as-code"
        }
    }

    ui = container "UI" "Keboola web application. Provides the main user interface for the platform." "JavaScript" {
        tags "JavaScript"
        url "https://github.com/keboola/kbc-ui"
        properties {
            "repos" "kbc-ui"
        }
    }

    # --- Shared infrastructure ---

    connection-elasticsearch = container "Connection Elasticsearch" "Self-hosted Elasticsearch cluster for Connection. Event search, global search index, audit log indexing. Namespace: connection-elasticsearch." "Other" {
        tags "SelfHosted" "Other"
    }

    job-queue-elasticsearch = container "Queue Elasticsearch" "Self-hosted Elasticsearch cluster for Queue. Job indexing and search. Separate instance, separate version from Connection Elasticsearch." "Other" {
        tags "SelfHosted" "Other"
    }

    # --- Uncommissioned / future containers ---

    git-service = container "Git Service" "Internal REST API wrapping the self-hosted Forgejo instance. Manages Git repositories on behalf of platform services." "Go" {
        tags "Go" "Uncommissioned"
        url "https://github.com/keboola/go-monorepo"
        properties {
            "repos" "go-monorepo"
        }

        git-service-api = component "Git Service API" "Go REST API. Wraps Forgejo admin API for repository management. Authenticates callers via Connection Manage API." "Go" {
            tags "Go"
        }
    }

    forgejo = container "Forgejo" "Self-hosted Git service. Stores and serves Git repositories for the platform. Deployed via upstream Bitnami/Forgejo Helm chart." "Other" {
        tags "SelfHosted" "Other" "Uncommissioned"
    }

    nats = container "NATS" "Planned NATS message broker. kbc-stacks chart exists but has no templates and no consumers. Not yet commissioned." "Other" {
        tags "Other" "Uncommissioned"
    }

    metastore = container "Metastore" "Stores and serves metadata objects and references for the platform. Implemented; gated on metastore_enabled in stack variables." "Go" {
        tags "Go" "Uncommissioned"
        url "https://github.com/keboola/go-monorepo"
        properties {
            "repos" "go-monorepo"
        }

        metastore-api = component "Metastore API" "Go REST API. Stores and queries metadata objects. Verifies tokens via Connection." "Go" {
            tags "Go"
        }
    }

    skill-registry = container "Skill Registry API" "PHP/Symfony REST API and React frontend for registering and executing agentic skills. Own authentication (X-API-TOKEN), OAuth broker for GitHub/Google/HubSpot/Slack/Salesforce. Deployed on canary-orion via its own Helm chart -- not in kbc-stacks and not on production stacks." "PHP" {
        tags "PHP" "Uncommissioned"
        url "https://github.com/keboola/skill-registry-api"
        properties {
            "repos" "skill-registry-api"
        }
    }

    skill-registry-mcp-server = container "Skill Registry MCP Server" "Python MCP server. Connects to the Skill Registry API and exposes registered skills as MCP tools. kbc-stacks chart exists but has no templates." "Python" {
        tags "Python" "Uncommissioned"
        url "https://github.com/keboola/skill-registry-mcp-server"
        properties {
            "repos" "skill-registry-mcp-server"
        }
    }
