# L3 inter-service relationships for job-queue-daemon
# Included inside keboolaPlatform block in model.dsl

# All daemon components call connection for token verification and project config
queue-daemon-run             -> connection         "verifies tokens, reads project configs"
queue-daemon-start           -> connection         "verifies tokens, reads project configs"
queue-daemon-stop            -> connection         "verifies tokens"
queue-daemon-flow-transition -> connection         "verifies tokens"

# Internal queue API — all active daemon processes poll/update job state
queue-daemon-run             -> queue-internal-api "polls for jobs to start, updates job state"
queue-daemon-start           -> queue-internal-api "processes jobs-to-start messages"
queue-daemon-stop            -> queue-internal-api "updates stopping job state"
queue-daemon-flow-transition -> queue-internal-api "processes flow job transitions"

# Notification — daemon pushes job events
queue-daemon-run             -> notification       "pushes job lifecycle events"
queue-daemon-stop            -> notification       "pushes job stop events"

# Billing — daemon records job usage
queue-daemon-run             -> billing            "records job usage for billing"

# Vault — daemon resolves variables for job pods
queue-daemon-run             -> vault              "resolves variables for job execution"
queue-daemon-start           -> vault              "resolves variables for job execution"

# CronJobs
daemon-cron-db-cleanup       -> queue-internal-api "cleans up stale DB records"
daemon-cron-flow-cleanup     -> queue-internal-api "removes stale flow job data"
