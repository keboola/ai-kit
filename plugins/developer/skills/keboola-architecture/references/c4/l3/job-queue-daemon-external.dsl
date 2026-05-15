# Cloud resource relationships for job-queue-daemon
# Included at top level of model block in model.dsl

# Shared job-runner KMS key -- used by daemon to decrypt job configuration injected into spawned pods
queue-daemon-run             -> kms-key-job-runner-aws   "decrypts job configuration in spawned pods on AWS stacks"
queue-daemon-run             -> kms-key-job-runner-azure "decrypts job configuration in spawned pods on Azure stacks"
queue-daemon-run             -> kms-key-job-runner-gcp   "decrypts job configuration in spawned pods on GCP stacks"

# MySQL
queue-daemon-run             -> mysql-instance-job-queue "persists daemon state"
queue-daemon-start           -> mysql-instance-job-queue "reads job records"
queue-daemon-flow-transition -> mysql-instance-job-queue "updates flow job state"
daemon-cron-db-cleanup       -> mysql-instance-job-queue "cleans up stale records"
daemon-cron-flow-cleanup     -> mysql-instance-job-queue "removes stale flow job data"

# K8s API (application-level -- spawning and cleaning up pods, all clouds)
queue-daemon-run        -> aws-eks   "spawns job pods via Kubernetes API on AWS stacks"
queue-daemon-run        -> azure-aks "spawns job pods via Kubernetes API on Azure stacks"
queue-daemon-run        -> gcp-gke   "spawns job pods via Kubernetes API on GCP stacks"
daemon-cron-pod-cleanup -> aws-eks   "cleans up orphaned pods via Kubernetes API on AWS stacks"
daemon-cron-pod-cleanup -> azure-aks "cleans up orphaned pods via Kubernetes API on Azure stacks"
daemon-cron-pod-cleanup -> gcp-gke   "cleans up orphaned pods via Kubernetes API on GCP stacks"

# Daemon-owned internal queues (Pattern A -- daemon publishes and consumes)
# jobs-to-start: daemon-run publishes, daemon-start consumes
queue-daemon-run   -> sqs-queue-daemon-jobs-to-start          "publishes jobs-to-start on AWS stacks"
queue-daemon-start -> sqs-queue-daemon-jobs-to-start          "consumes jobs-to-start on AWS stacks"
queue-daemon-run   -> servicebus-queue-daemon-jobs-to-start   "publishes jobs-to-start on Azure stacks"
queue-daemon-start -> servicebus-queue-daemon-jobs-to-start   "consumes jobs-to-start on Azure stacks"
queue-daemon-run   -> pubsub-topic-daemon-jobs-to-start       "publishes jobs-to-start on GCP stacks"
queue-daemon-start -> pubsub-topic-daemon-jobs-to-start       "consumes jobs-to-start on GCP stacks"

# flow-jobs-transition: daemon-run publishes, daemon-flow-transition consumes
queue-daemon-run             -> sqs-queue-daemon-flow-jobs-transition          "publishes flow-jobs-transition on AWS stacks"
queue-daemon-flow-transition -> sqs-queue-daemon-flow-jobs-transition          "consumes flow-jobs-transition on AWS stacks"
queue-daemon-run             -> servicebus-queue-daemon-flow-jobs-transition   "publishes flow-jobs-transition on Azure stacks"
queue-daemon-flow-transition -> servicebus-queue-daemon-flow-jobs-transition   "consumes flow-jobs-transition on Azure stacks"
queue-daemon-run             -> pubsub-topic-daemon-flow-jobs-transition       "publishes flow-jobs-transition on GCP stacks"
queue-daemon-flow-transition -> pubsub-topic-daemon-flow-jobs-transition       "consumes flow-jobs-transition on GCP stacks"
