# runner-sync-api — dependency analysis

## Deployed components
- `sync-actions-api` (Deployment): container `runner-sync-api` (PHP API)

## Inter-service dependencies
- `sync-actions-api` -> `connection`: `STORAGE_API_URL` via `Keboola\StorageApiBranch\Factory\ClientOptions` and `Keboola\ManageApi\Client` in services.yaml
- `sync-actions-api` -> `vault`: `VAULT_API_URL` via `App\VaultVariablesApiClientFactory` in services.yaml

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `kms-key-job-runner-aws` | KMS key (AWS) | encryption-api, job-queue-daemon, queue-runner | `job_runner_kms_key_id = data.aws_cloudformation_stack.kbc_job_runner_kms_key...` in app_runner_sync_api.tf; `s3:PutObject` IAM policy on `runner_sync_api_debug_logs` confirms S3 usage too |
| `kms-key-job-runner-azure` | Key Vault key (Azure) | encryption-api, job-queue-daemon, queue-runner | `AZURE_KEY_VAULT_URL` in azure/main.tf |
| `kms-key-job-runner-gcp` | Cloud KMS key (GCP) | encryption-api, job-queue-daemon, queue-runner | `GCP_KMS_KEY_ID` in gcp/main.tf |
| `s3-bucket-logs` | Object storage | connection, omnisearch | `logs_bucket_arn` in app_runner_sync_api.tf; IAM policy `runner_sync_api_debug_logs` confirms `s3:PutObject` |

## Unresolved
- `GELF_SERVER_URL`: used in `KubernetesSpecificationProvider` — injected into spawned pods as logging endpoint, not a direct HTTP dependency of sync-actions-api itself
- `K8S_HOST`, `K8S_TOKEN`, `K8S_CA_CERT_PATH`, `K8S_NAMESPACE`: Kubernetes API credentials — service spawns sync action pods directly via `Keboola\K8sClient\KubernetesApiClientFacade`
