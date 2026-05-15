# Cloud resource relationships for job-queue
# Included at top level of model block in model.dsl

# Public API -- uses shared job-runner KMS key for token decryption
queue-public-api   -> kms-key-job-runner-aws   "decrypts job configuration on AWS stacks"
queue-public-api   -> kms-key-job-runner-azure "decrypts job configuration on Azure stacks"
queue-public-api   -> kms-key-job-runner-gcp   "decrypts job configuration on GCP stacks"

# Internal API group
queue-internal-api -> mysql-instance-job-queue "persists job data"
queue-logstash     -> mysql-instance-job-queue "reads job data for replication to Elasticsearch"
queue-cleanup      -> mysql-instance-job-queue "deletes job records for purged projects"
queue-purge        -> mysql-instance-job-queue "purges old job records"
queue-replication-check -> mysql-instance-job-queue "checks DB replication state"

# Runner group -- uses shared job-runner KMS key
queue-runner     -> kms-key-job-runner-aws   "decrypts job configuration on AWS stacks"
queue-runner     -> kms-key-job-runner-azure "decrypts job configuration on Azure stacks"
queue-runner     -> kms-key-job-runner-gcp   "decrypts job configuration on GCP stacks"
queue-job-runner -> kms-key-job-runner-aws   "decrypts job configuration on AWS stacks (legacy)"
queue-job-runner -> kms-key-job-runner-azure "decrypts job configuration on Azure stacks (legacy)"
queue-job-runner -> kms-key-job-runner-gcp   "decrypts job configuration on GCP stacks (legacy)"
