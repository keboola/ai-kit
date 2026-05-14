# stream — dependency analysis

## Deployed components
- `stream-api` (Deployment): Go REST API. Manages stream definitions (sources, sinks). Authenticates
  via Storage API. All components run the same binary with different `--args`.
- `stream-http-source` (Deployment): HTTP ingest endpoint. Accepts incoming data records from external
  producers. High-replica, CPU-bound.
- `stream-storage-coordinator` (Deployment): Orchestrates the lifecycle of slices and files — triggers
  uploads and imports into Keboola Storage.
- `stream-storage-writer` (StatefulSet container): Receives encoded data from http-source nodes over
  TCP/KCP network transport, buffers to local disk volumes.
- `stream-storage-reader` (StatefulSet container): Reads locally buffered data and uploads to staging
  storage, then triggers import into Keboola Storage (connection). Co-located with writer in one
  StatefulSet pod (`stream-storage-writer-reader`).

## Inter-service dependencies
- All components -> `connection`: via `storageApiHost: "connection.{{ .Values.hostnameSuffix }}"` in
  config.yaml. Used for token validation (API), and for staging file upload + table import
  (storage-coordinator, storage-writer, storage-reader).

## Named cloud resource dependencies
| Resource ID | Type | Evidence |
|---|---|---|
| `kms-key-stream-aws` | AWS KMS key (service-owned) | `aws_kms_key.stream_encryption` in aws/main.tf. ENV: `STREAM_ENCRYPTION_AWS_KMS_KEY_ID` |
| `kms-key-stream-azure` | Azure Key Vault key (service-owned) | `azurerm_key_vault_key.stream_encryption` in azure/main.tf. ENV: `STREAM_ENCRYPTION_AZURE_KEY_NAME`, `STREAM_ENCRYPTION_AZURE_KEY_VAULT_URL` |
| `kms-key-stream-gcp` | GCP Cloud KMS key (service-owned) | `google_kms_crypto_key.stream_encryption` in gcp/main.tf |
| `efs-stream-etcd-snapshots` | AWS EFS file system | `aws_efs_file_system.stream_etcd_snapshots` in aws/snapshots.tf. Used as StorageClass for etcd snapshots |
| `abs-stream-etcd-snapshots` | Azure Blob Storage account | `azurerm_storage_account.stream_etcd_snapshots` in azure/snapshots.tf. Used as StorageClass for etcd snapshots |
| `gcs-stream-etcd-snapshots` | GCP GCS bucket | `google_storage_bucket.stream_etcd_snapshots_bucket` in gcp/main.tf. Used for etcd disaster recovery snapshots |

## etcd — separate instance from templates-api (IMPORTANT)

Stream deploys its own Bitnami etcd sub-chart (`stream-etcd`, `fullnameOverride: stream-etcd`)
as part of the stream Helm release, in the `stream` K8s namespace.

**This is completely separate from `templates-api-etcd`** (which is in the `templates-api` namespace).

| | stream etcd | templates-api etcd |
|---|---|---|
| Endpoint | `stream-etcd.stream.svc.cluster.local:2379` | `templates-api-etcd.templates-api.svc.cluster.local:2379` |
| Namespace (etcd data) | `stream/` | `templates-api` |
| K8s namespace | `stream` | `templates-api` |
| Replicas | 1 (default, configurable) | 3 |
| Purpose | Distributed cluster coordination (node registration, slice/file state machine, statistics sync, task locking) | Write atomicity locking only |
| Snapshot storage | EFS (AWS) / ABS (Azure) / GCS (GCP) — via Kubernetes StorageClass + Bitnami disaster recovery | None (no snapshot config) |

## New resources added to cloud-resources.dsl
- `kms-key-stream-aws`, `kms-key-stream-azure`, `kms-key-stream-gcp`: stream-owned encryption keys
- `efs-stream-etcd-snapshots`: AWS EFS for etcd snapshot storage
- `abs-stream-etcd-snapshots`: Azure Blob Storage for etcd snapshot storage
- `gcs-stream-etcd-snapshots`: GCP GCS bucket for etcd snapshot storage

## Notes
- All stream components use the same Docker image, differentiated only by the `args` field
  (`api`, `http-source`, `storage-coordinator`, `storage-writer`, `storage-reader`).
- The KMS keys encrypt the data payloads written to disk volumes by the writer — not db encryption.
- The etcd snapshot storage (EFS/ABS/GCS) is used by the Bitnami etcd `disasterRecovery` cronjob.
  It is NOT a runtime application dependency — it is a backup/restore mechanism for etcd itself.
