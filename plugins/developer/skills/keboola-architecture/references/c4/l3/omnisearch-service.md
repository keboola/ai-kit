# omnisearch-service — dependency analysis

## Deployed components
- `omnisearch-service-api` (Deployment): FastAPI REST API for lineage and metadata queries
- `omnisearch-metastore-builder` (CronJob, data-driven per org): Builds and uploads metastore files per organization. Template iterates over `organizationIds` — all instances are one component named `omnisearch-metastore-builder`.

## Inter-service dependencies
- `omnisearch-service-api` -> `connection`: `kbcstorage.client.Client` using `STORAGE_API_URL` in `restapi/auth.py` — token verification; Management API client (`X-KBC-ManageApiToken`) in `metastore/kbcmanagement.py`
- `omnisearch-metastore-builder` -> `connection`: `kbcstorage.client.Client` in `metastore/builder.py` and `metastore/metadata_upload.py`; Management API client in `metastore/kbcmanagement.py`
- `omnisearch-metastore-builder` -> `queue`: `QueueClient` in `metastore/impl.py` — URL derived at runtime via `re.sub(r"((?<=/)|^)connection\.", "queue.", url)`; invisible to ENV scanning

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `azure-openai-ai-service` | Azure OpenAI | ai-service | `azure_open_ai_* = module.azure_openai[0].*` in app_omnisearch_service.tf; present in all three cloud variants |
| `s3-bucket-logs` | Object storage (logs/metastore) | connection, sync-actions | Metastore files written/read per cloud variant; AWS S3 (`AWS_METASTORE_S3_BUCKET`), Azure ABS, GCP GCS in infra_secrets |

## Unresolved
None.

## Notes
- Queue URL is not injected via ENV — derived at runtime in `metastore/impl.py` by substituting `connection.` with `queue.` in the Storage API URL. Invisible to ENV-only scanning.
- Azure OpenAI is present with non-empty values in all three cloud variants — cross-cloud dependency.
