# encryption-api — dependency analysis

## Deployed components
- `encryption-api` (Deployment): PHP REST API

## Inter-service dependencies
- `encryption-api` -> `connection`: `Keboola\StorageApiBranch\Factory\StorageClientPlainFactory` in services.yaml — token validation

## Named cloud resource dependencies
| Resource ID | Type | Shared with | Evidence |
|---|---|---|---|
| `kms-key-job-runner-aws` | KMS key (AWS) | job-queue-daemon, queue-runner, sync-actions | `job_runner_kms_key_id = data.aws_cloudformation_stack.kbc_job_runner_kms_key...` in app_encryption_api.tf |
| `kms-key-job-runner-azure` | Key Vault key (Azure) | job-queue-daemon, queue-runner, sync-actions | `AZURE_KEY_VAULT_URL` in azure/main.tf |
| `kms-key-job-runner-gcp` | Cloud KMS key (GCP) | job-queue-daemon, queue-runner, sync-actions | `GCP_KMS_KEY_ID` in gcp/main.tf |

## Unresolved
None.

## Notes
- The migration feature (`ConfigurationMigrator`) instantiates `ObjectEncryptor` for multiple remote stacks using their KMS keys. These are still the same three shared keys (`kms-key-job-runner-aws/azure/gcp`) — just used for cross-stack re-encryption, not additional key dependencies.
