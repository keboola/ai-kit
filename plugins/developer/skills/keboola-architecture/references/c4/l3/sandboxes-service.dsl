# L3 inter-service relationships for sandboxes
# Included inside keboolaPlatform block in model.dsl

# sandboxes-service-api
sandboxes-service-api -> connection   "verifies tokens, reads project context, manages workspaces via Storage and Manage APIs"
sandboxes-service-api -> billing      "reports sandbox and app usage (BILLING_ENABLED)"
sandboxes-service-api -> encryption   "decrypts app proxy auth configuration via Encryption API"
sandboxes-service-api -> git-service  "manages Git repositories for apps (internal cluster URL)"

# garbage collector
sandboxes-service-garbage-collector -> connection "reads project/token context via Storage API"

# suspend -- reads app records, provisions tokens via StorageApiTokenProvider, manages K8s state
sandboxes-service-suspend -> connection "retrieves provisioning tokens via StorageApiTokenProvider for app state transitions"

# messenger consumers — Pattern B: receive events from Connection
sandboxes-service-messenger-consumer-connection-events    -> connection "receives project and sandbox lifecycle events published by Connection (async)"
sandboxes-service-messenger-consumer-connection-audit-log -> connection "receives audit log events published by Connection (async)"

# apps-proxy -- calls sandboxes-service-api for app config and auth; ALSO directly watches App CRDs
# in K8s via AppStateWatcher (dynamic client) to determine running state and route traffic to pods.
# Note: relationship to sandboxes-service-api only (not the container) -- Structurizr prohibits parent-child relationships
apps-proxy -> sandboxes-service-api "fetches app configuration and validates requests via Sandboxes Service API"

# keboola-operator -- runs INSIDE the cluster (in-cluster credentials), not an external caller.
# K8s API usage is internal to its operation as a controller. External dependencies only:
keboola-operator -> connection "provisions Storage tokens and reads project context via APPLICATION_TOKEN"
keboola-operator -> e2b        "manages E2B sandbox lifecycle for E2bSandbox CRDs via E2B_API_KEY"

# sandboxes component (ephemeral job pod — runs via job-queue runner infrastructure)
sandboxes-component -> connection         "reads Storage API data and performs input/output mapping"
sandboxes-component -> sandboxes-service-api "manages sandbox and app lifecycle via Sandboxes Service API client"
