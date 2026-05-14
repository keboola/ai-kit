model {

    # -------------------------------------------------------------------------
    # People / Personas
    # -------------------------------------------------------------------------

    dataEngineer = person "Data Engineer" "Builds and maintains data pipelines, components, and platform foundations."
    dataAnalyst  = person "Data Analyst" "Explores and consumes data for business insights. Can be any business role (CFO, marketing, etc.)."
    developer    = person "Developer" "Builds and publishes Keboola components via the Developer Portal. Also uses the platform directly."
    endUser      = person "End User" "Consumes Data Apps built on the Keboola platform. May have no awareness of Keboola itself."

    # -------------------------------------------------------------------------
    # External Systems (cloud vendor aggregates + SaaS)
    # -------------------------------------------------------------------------

    !include ../l3/external-systems.dsl

    # -------------------------------------------------------------------------
    # Named Cloud Resource Instances
    # -------------------------------------------------------------------------

    !include ../l3/cloud-resources.dsl

    # -------------------------------------------------------------------------
    # L1 Software Systems
    # -------------------------------------------------------------------------

    keboolaPlatform = softwareSystem "Keboola Platform" "Multi-tenant data platform providing storage, pipelines, workspaces, AI tooling and more. Deployed as independent stacks per region and cloud provider." {
        !include ../l2/containers.dsl

        # L3 inter-service relationships
        !include ../l3/ai-service.dsl
        !include ../l3/editor-service.dsl
        !include ../l3/runner-sync-api.dsl
        !include ../l3/scheduler.dsl
        !include ../l3/job-queue.dsl
        !include ../l3/job-queue-daemon.dsl
        !include ../l3/encryption-api.dsl
        !include ../l3/omnisearch-service.dsl
        !include ../l3/vault.dsl
        !include ../l3/connection.dsl
        !include ../l3/billing-api.dsl
        !include ../l3/notification-service.dsl
        !include ../l3/sapi-importer.dsl
        !include ../l3/oauth-service.dsl
        !include ../l3/mcp-server.dsl
        !include ../l3/templates-api.dsl
        !include ../l3/stream.dsl
        !include ../l3/kai-assistant.dsl
        !include ../l3/api-service.dsl
        !include ../l3/query-service.dsl
        !include ../l3/git-service.dsl
        !include ../l3/metastore-service.dsl
        !include ../l3/sandboxes-service.dsl

        # skill-registry: intra-system relationship (no L3 file -- uncommissioned, no Terraform)
        skill-registry-mcp-server -> skill-registry "reads registered skills and executes them (KBC_SKILL_REGISTRY_URL)"
    }

    developerPortal = softwareSystem "Developer Portal" "Satellite system for component developers. Manages component registration and publishing. Loosely synchronized with each Keboola stack." {
        devPortalWeb = container "Developer Portal Web" "UI for browsing and managing components." "JavaScript" {
            url "https://github.com/keboola/developer-portal-ui"
        }
        devPortalApi = container "Developer Portal API" "REST API for component registration and management." "JavaScript" {
            url "https://github.com/keboola/developer-portal"
        }
    }

    telemetry = softwareSystem "Telemetry" "Satellite system built on top of the platform. Collects and exposes usage data to end users and drives billing calculations." {
        telemetryRaw        = container "Telemetry Raw Projects" "Collects raw project-level telemetry data." "" {
            url "https://github.com/keboola/telemetry-raw-projects"
        }
        telemetryBillingGcp = container "Telemetry Billing GCP" "GCP-specific billing telemetry pipeline." "" {
            url "https://github.com/keboola/telemetry-billing-gcp"
        }
        embedTelemetry      = container "Embed Telemetry" "Embeds telemetry data into the platform UI." "" {
            url "https://github.com/keboola/embed-telemetry"
        }
        gooddataCn          = container "GoodData CN Provisioning" "GoodData Cloud Native provisioning for telemetry outputs." "" {
            url "https://github.com/keboola/gooddata-cn-provisioning"
        }
    }

    # -------------------------------------------------------------------------
    # L1 Relationships — personas
    # -------------------------------------------------------------------------

    dataEngineer -> keboolaPlatform "Builds pipelines, manages components, runs jobs, uses Workspaces and SQL Editor"
    dataEngineer -> telemetry       "Monitors pipeline performance and resource usage"
    dataAnalyst  -> keboolaPlatform "Explores and queries data, consumes reports and dashboards"
    dataAnalyst  -> telemetry       "Consumes telemetry-derived reports"
    endUser      -> keboolaPlatform "Consumes Data Apps"
    developer    -> keboolaPlatform "Tests and runs components, manages configurations"
    developer    -> developerPortal "Registers and publishes components"

    telemetry       -> keboolaPlatform "Uses Storage API and Jobs to collect and process telemetry data"
    keboolaPlatform -> telemetry       "Feeds usage events; billing figures flow back into platform billing"

    # L1 Relationships — cloud vendors
    keboolaPlatform -> aws       "Runs on, stores data in, and encrypts with AWS services"
    keboolaPlatform -> azure     "Runs on, stores data in, encrypts with, and uses AI from Azure services"
    keboolaPlatform -> gcp       "Runs on, stores data in, and encrypts with GCP services"
    keboolaPlatform -> datadog   "Ships metrics, traces, logs, and APM telemetry from all services"
    keboolaPlatform -> langsmith "Ships LLM call traces from KAI apps (ai-chat, kai-assistant, kai-agent)"
    keboolaPlatform -> snowflake "Uses as a customer data warehouse backend"
    keboolaPlatform -> bigquery  "Uses as a customer data warehouse backend"
    keboolaPlatform -> synapse   "Uses as a customer data warehouse backend"
    keboolaPlatform -> exasol    "Uses as a customer data warehouse backend"
    keboolaPlatform -> supabase  "Uses as a customer data warehouse backend (BYODB)"
    keboolaPlatform -> sendgrid  "Sends transactional emails via SMTP relay"
    keboolaPlatform -> stripe    "Processes pay-as-you-go credit purchases"
    keboolaPlatform -> azure-marketplace  "Manages PAYG subscriptions and reports metered usage (Azure stacks)"
    keboolaPlatform -> google-marketplace "Manages PAYG entitlements and consumes marketplace events (GCP stacks)"
    keboolaPlatform -> github    "Clones template repositories at runtime to read template definitions (templates-api)"
    keboolaPlatform -> e2b       "Executes sandboxed code via E2B (kai-agent, keboola-operator)"

    # -------------------------------------------------------------------------
    # L3 External relationships
    # -------------------------------------------------------------------------

    !include ../l3/ai-service-external.dsl
    !include ../l3/editor-service-external.dsl
    !include ../l3/runner-sync-api-external.dsl
    !include ../l3/scheduler-external.dsl
    !include ../l3/job-queue-external.dsl
    !include ../l3/job-queue-daemon-external.dsl
    !include ../l3/encryption-api-external.dsl
    !include ../l3/omnisearch-service-external.dsl
    !include ../l3/vault-external.dsl
    !include ../l3/connection-external.dsl
    !include ../l3/billing-api-external.dsl
    !include ../l3/notification-service-external.dsl
    !include ../l3/sapi-importer-external.dsl
    !include ../l3/oauth-service-external.dsl
    !include ../l3/mcp-server-external.dsl
    !include ../l3/templates-api-external.dsl
    !include ../l3/stream-external.dsl
    !include ../l3/kai-assistant-external.dsl
    !include ../l3/api-service-external.dsl
    !include ../l3/query-service-external.dsl
    !include ../l3/git-service-external.dsl
    !include ../l3/metastore-service-external.dsl
    !include ../l3/sandboxes-service-external.dsl

}
