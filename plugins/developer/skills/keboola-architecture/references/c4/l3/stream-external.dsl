# Cloud resource relationships for stream
# Included at top level of model block in model.dsl

# Service-owned KMS / Key Vault keys — used for encrypting data payloads written to disk volumes
stream-storage-writer -> kms-key-stream-aws   "encrypts data payloads written to disk on AWS stacks"
stream-storage-writer -> kms-key-stream-azure "encrypts data payloads written to disk on Azure stacks"
stream-storage-writer -> kms-key-stream-gcp   "encrypts data payloads written to disk on GCP stacks"

# etcd snapshot storage — used by Bitnami disaster recovery cronjob (not runtime application dependency)
# Note: these are storage backends for etcd's own backup/restore, not used by stream application code directly
stream-etcd -> efs-stream-etcd-snapshots  "stores etcd snapshots for disaster recovery on AWS stacks"
stream-etcd -> abs-stream-etcd-snapshots  "stores etcd snapshots for disaster recovery on Azure stacks"
stream-etcd -> gcs-stream-etcd-snapshots  "stores etcd snapshots for disaster recovery on GCP stacks"
