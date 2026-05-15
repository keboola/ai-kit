    # -------------------------------------------------------------------------
    # External Systems — Cloud Vendors (L1 aggregated only)
    # -------------------------------------------------------------------------
    # Granular type-level vendor nodes (aws-kms, aws-sqs etc.) have been removed.
    # Individual named resource instances are defined in cloud-resources.dsl.
    # -------------------------------------------------------------------------

    aws   = softwareSystem "Amazon Web Services" "Cloud infrastructure provider. EKS, RDS, S3, KMS, SQS, SNS and more." {
        tags "Vendor" "CloudProvider"
        url "https://aws.amazon.com"
    }
    azure = softwareSystem "Microsoft Azure" "Cloud infrastructure provider. AKS, Azure Database, ABS, Key Vault, Service Bus, Event Grid, Azure OpenAI." {
        tags "Vendor" "CloudProvider"
        url "https://azure.microsoft.com"
    }
    gcp   = softwareSystem "Google Cloud" "Cloud infrastructure provider. GKE, Cloud SQL, GCS, Cloud KMS, Pub/Sub." {
        tags "Vendor" "CloudProvider"
        url "https://cloud.google.com"
    }

    datadog = softwareSystem "Datadog" "Observability platform. Metrics, traces, logs, and APM across all platform services. Implicit dependency — every service ships telemetry to Datadog." {
        tags "Vendor"
        url "https://www.datadoghq.com"
    }

    langsmith = softwareSystem "LangSmith" "LLM observability and tracing platform. Implicit dependency — KAI apps (ai-chat, kai-assistant, kai-agent) ship LLM call traces to LangSmith. Same modelling treatment as Datadog: platform-level L1 relationship only, never per-component." {
        tags "Vendor"
        url "https://smith.langchain.com"
    }

    github = softwareSystem "GitHub" "Source code hosting and Git service. Accessed at runtime by templates-api to clone template repositories (keboola/keboola-as-code-templates). Operational dependency, not just development." {
        tags "Vendor"
        url "https://github.com"
    }

    # --- Marketplaces ---
    azure-marketplace  = softwareSystem "Azure Marketplace" "Microsoft Azure Marketplace. Used for PAYG subscription management and metered usage reporting on Azure stacks." {
        tags "Vendor"
        url "https://azuremarketplace.microsoft.com"
    }
    google-marketplace = softwareSystem "Google Cloud Marketplace" "Google Cloud Marketplace. Used for PAYG entitlement management and marketplace event consumption on GCP stacks." {
        tags "Vendor"
        url "https://cloud.google.com/marketplace"
    }

    # --- Customer storage backends ---
    snowflake = softwareSystem "Snowflake" "Cloud data warehouse. Customer storage backend." {
        tags "Vendor"
        url "https://www.snowflake.com"
    }
    bigquery  = softwareSystem "Google BigQuery" "Serverless cloud data warehouse (GCP). Customer storage backend." {
        tags "Vendor"
        url "https://cloud.google.com/bigquery"
    }
    synapse   = softwareSystem "Azure Synapse Analytics" "Cloud analytics service (Azure). Legacy customer storage backend." {
        tags "Vendor" "Legacy"
        url "https://azure.microsoft.com/en-us/products/synapse-analytics"
    }
    exasol    = softwareSystem "Exasol" "In-memory analytics database. Legacy customer storage backend." {
        tags "Vendor" "Legacy"
        url "https://www.exasol.com"
    }
    supabase  = softwareSystem "Supabase" "Open-source Postgres platform. Uncommissioned customer storage backend (BYODB)." {
        tags "Vendor" "Uncommissioned"
        url "https://supabase.com"
    }

    # --- SaaS integrations ---
    sendgrid = softwareSystem "SendGrid" "Email delivery service. Transactional emails (invitations, notifications, token sharing)." {
        tags "Vendor"
        url "https://sendgrid.com"
    }
    stripe   = softwareSystem "Stripe" "Payment processing platform. Pay-as-you-go credit purchases." {
        tags "Vendor"
        url "https://stripe.com"
    }

    # --- Kubernetes managed services ---
    # Tagged "CloudResource" (not "Vendor"/"CloudProvider") so they can appear in L3 component views
    # for services that make explicit application-level K8s API calls (pod management, CRD operations,
    # resource watching). This is NOT the generic "runs-on" relationship shown at L1.
    aws-eks   = softwareSystem "AWS EKS" "Managed Kubernetes (AWS). Referenced by services that explicitly call the K8s API at application level." {
        tags "CloudResource" "AWS"
    }
    azure-aks = softwareSystem "Azure AKS" "Managed Kubernetes (Azure). Referenced by services that explicitly call the K8s API at application level." {
        tags "CloudResource" "Azure"
    }
    gcp-gke   = softwareSystem "GCP GKE" "Managed Kubernetes (GCP). Referenced by services that explicitly call the K8s API at application level." {
        tags "CloudResource" "GCP"
    }
