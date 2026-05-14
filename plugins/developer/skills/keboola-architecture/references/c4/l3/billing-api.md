# billing-api — dependency analysis

## Deployed components
- `billing-api` (Deployment): PHP Symfony REST API — credits, PAYG top-up, marketplace webhooks
- `billing-gcp-marketplace-consumer` (Deployment, GCP stacks only): command `messenger:consume google_marketplace_events` — processes Google Cloud Marketplace entitlement and account events via Pub/Sub subscription on Google's marketplace topic (`projects/cloudcommerceproc-prod/topics/keboola-marketplace`)
- `billing-marketplaces-reporting-azure` (CronJob, Azure stacks only, every 20 min): command `app:marketplaces:report-usage azure` — reports hourly usage batches to Azure Marketplace Metering Service

## Inter-service dependencies
- `billing-api` -> `connection`: `Keboola\StorageApiBranch\Factory\ClientOptions` + `App\Factory\ManageApiClientFactory` using `STORAGE_API_URL` in services.yaml; `App\Credits\PayAsYouGoClient` also calls Connection's PAYG API with `APPLICATION_TOKEN`
- `billing-api` -> `queue`: `App\Factory\QueueApiClientFactory` calls `storageApiClient->getServiceUrl('queue')` — URL resolved dynamically via Storage API, not from ENV
- `billing-gcp-marketplace-consumer` -> `connection`: token verification
- `billing-marketplaces-reporting-azure` -> `connection`: reads subscription and billing data

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `mysql-instance-job-queue` | MySQL instance | job-queue, editor, scheduler, vault, notification, ai | `mysql_config = local.job_queue_mysql_config` in app_billing_api.tf (Azure + GCP) |
| `azure-marketplace` | SaaS | — | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` in azure/infra_secrets.tf; `Keboola\AzureApiClient\Marketplace\MarketplaceApiClient` and `MeteringServiceApiClient` in services.yaml |
| `google-marketplace` | SaaS | — | `GOOGLE_MARKETPLACE_EVENTS_QUEUE_DSN` subscribing to `projects/cloudcommerceproc-prod/topics/keboola-marketplace`; `App\Marketplace\GoogleCloud\ApiClient\ProcurementApiClientFactory` in services.yaml |

## Unresolved
None.

## Notes
- No AWS module exists for billing-api — it runs on Azure and GCP stacks only. No AWS KMS, no AWS MySQL.
- Queue URL is resolved dynamically via `storageApiClient->getServiceUrl('queue')` — not injected as a dedicated ENV key, so invisible to ENV-only scanning.
- The GCP Pub/Sub subscription subscribes to Google's own marketplace topic (`projects/cloudcommerceproc-prod/...`), not a Keboola-owned resource. Modelled via `google-marketplace`, not as a named cloud resource instance.
