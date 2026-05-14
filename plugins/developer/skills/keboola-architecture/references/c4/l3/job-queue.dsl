# L3 inter-service relationships for job-queue
# Included inside keboolaPlatform block in model.dsl

# queue-public-api is the only external-facing component
queue-public-api -> connection          "verifies tokens, reads component configs"

# queue-internal-api group
queue-internal-api -> connection        "verifies tokens via Storage API"
queue-cleanup      -> connection        "verifies tokens"
queue-purge        -> connection        "verifies tokens"
queue-replication-check -> connection   "verifies tokens"

# queue-runner (job execution components)
# Note: queue-runner is ephemeral — it runs inside a per-job K8s pod spawned by the daemon
# and exits when the job completes. It is modelled as a component for relationship clarity,
# not because it is a long-running deployed service.
queue-runner -> connection             "reads job config and storage data"
queue-runner -> vault                  "resolves variables before job execution"

# queue-gelf-logger
queue-gelf-logger -> connection        "writes job logs to Storage"

# queue-job-runner (legacy)
queue-job-runner -> connection         "reads job config and storage data"
queue-job-runner -> queue-internal-api "updates job state"
queue-job-runner -> vault              "resolves variables before job execution"

# internal wiring — public-api calls internal-api (same container, not cross-container)
queue-public-api -> queue-internal-api "creates and queries jobs (internal)"

# logstash replicates DB to Elasticsearch
queue-logstash -> job-queue-elasticsearch        "replicates job records for search"
queue-internal-api -> job-queue-elasticsearch    "indexes and searches jobs"
queue-replication-check -> job-queue-elasticsearch "checks replication lag"
