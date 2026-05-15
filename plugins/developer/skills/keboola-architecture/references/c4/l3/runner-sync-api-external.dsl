# Cloud resource relationships for runner-sync-api
# Included at top level of model block in model.dsl

sync-actions-api -> kms-key-job-runner-aws   "decrypts component configuration in spawned sync-action pods on AWS stacks"
sync-actions-api -> kms-key-job-runner-azure "decrypts component configuration in spawned sync-action pods on Azure stacks"
sync-actions-api -> kms-key-job-runner-gcp   "decrypts component configuration in spawned sync-action pods on GCP stacks"
sync-actions-api -> s3-bucket-logs           "writes job artefacts and logs"
sync-actions-api -> aws-eks                  "spawns sync action pods via Kubernetes API"
sync-actions-api -> azure-aks                "spawns sync action pods via Kubernetes API"
sync-actions-api -> gcp-gke                  "spawns sync action pods via Kubernetes API"
