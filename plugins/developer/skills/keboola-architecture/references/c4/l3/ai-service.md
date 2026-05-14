# ai-service — dependency analysis

## Deployed components
- `ai-api` (Deployment): containers `app` (PHP API) + `agent` (Python kai-bot sidecar, localhost:8181 only)
- `ai-index-builder` (CronJob, daily at 05:20): container `agent` (Python, runs shared builder script)

## Inter-service dependencies
- `ai-api` -> `connection`: `getConnectionServiceUrl` via `Keboola\ManageApi\Client` and `Keboola\StorageApiBranch\Factory\ClientOptions` in services.yaml
- `ai-api` -> `queue`: `getQueueUrl` via `App\JobQueueClientFactory` in services.yaml
- `ai-api` -> `stream`: `PROMPT_RECORD_URL`, `FEEDBACK_RECORD_URL` injected via appSecrets (confirmed in service-knowledge.md)

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `azure-openai-ai-service` | Azure OpenAI | omnisearch | `AZURE_OPENAI_ENDPOINT`, `AZURE_LLM_DEPLOYMENT`, `AZURE_EMBEDS` — present in all three cloud variants; `module.azure_openai[0]` in app_ai_service.tf |
| `mysql-instance-job-queue` | MySQL instance | job-queue, editor, scheduler, vault, notification, billing | `mysql_config = local.job_queue_mysql_config` in app_ai_service.tf |

## Unresolved
None.
