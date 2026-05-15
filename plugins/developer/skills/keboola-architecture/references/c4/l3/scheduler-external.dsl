# Cloud resource relationships for scheduler
# Included at top level of model block in model.dsl

scheduler-api  -> mysql-instance-job-queue "persists schedules (shares job-queue MySQL instance)"
scheduler-api  -> kms-key-scheduler-aws   "encrypts data at rest on AWS stacks"
scheduler-api  -> kms-key-scheduler-azure "encrypts data at rest on Azure stacks"
scheduler-api  -> kms-key-scheduler-gcp   "encrypts data at rest on GCP stacks"

scheduler-cron -> mysql-instance-job-queue "reads due schedules (shares job-queue MySQL instance)"
scheduler-cron -> kms-key-scheduler-aws   "encrypts data at rest on AWS stacks"
scheduler-cron -> kms-key-scheduler-azure "encrypts data at rest on Azure stacks"
scheduler-cron -> kms-key-scheduler-gcp   "encrypts data at rest on GCP stacks"
