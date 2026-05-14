# Cloud resource relationships for sandboxes
# Included at top level of model block in model.dsl

# --- sandboxes-service-api ---
sandboxes-service-api -> mysql-instance-job-queue              "persists sandbox and app records (data_science database)"
sandboxes-service-api -> kms-key-job-runner-aws                "decrypts app OAuth/config secrets encrypted by job-queue component on AWS stacks"
sandboxes-service-api -> kms-key-job-runner-azure              "decrypts app OAuth/config secrets encrypted by job-queue component on Azure stacks"
sandboxes-service-api -> kms-key-job-runner-gcp                "decrypts app OAuth/config secrets encrypted by job-queue component on GCP stacks"
sandboxes-service-api -> kms-key-sandboxes-service-aws         "internal encryption of app configuration on AWS stacks"
sandboxes-service-api -> kms-key-sandboxes-service-azure       "internal encryption of app configuration on Azure stacks"
sandboxes-service-api -> kms-key-sandboxes-service-gcp         "internal encryption of app configuration on GCP stacks"
sandboxes-service-api -> aws-eks                               "spawns and manages sandbox/app pods via Kubernetes API"
sandboxes-service-api -> azure-aks                             "spawns and manages sandbox/app pods via Kubernetes API"
sandboxes-service-api -> gcp-gke                               "spawns and manages sandbox/app pods via Kubernetes API"

# --- sandboxes-service-garbage-collector ---
sandboxes-service-garbage-collector -> mysql-instance-job-queue "reads sandbox records to identify orphans"
sandboxes-service-garbage-collector -> aws-eks                  "deletes orphaned pods and PVCs via Kubernetes API"
sandboxes-service-garbage-collector -> azure-aks                "deletes orphaned pods and PVCs via Kubernetes API"
sandboxes-service-garbage-collector -> gcp-gke                  "deletes orphaned pods and PVCs via Kubernetes API"

# --- sandboxes-service-suspend ---
sandboxes-service-suspend -> mysql-instance-job-queue "reads app records to find inactive sandboxes and apps"
sandboxes-service-suspend -> aws-eks                  "lists running App CRDs and transitions expired apps via Kubernetes API"
sandboxes-service-suspend -> azure-aks                "lists running App CRDs and transitions expired apps via Kubernetes API"
sandboxes-service-suspend -> gcp-gke                  "lists running App CRDs and transitions expired apps via Kubernetes API"

# --- apps-proxy ---
# Watches App CRDs via K8s dynamic client (AppStateWatcher) to determine pod routing.
# Also calls sandboxes-service-api for app config and auth (in internal DSL).
apps-proxy -> aws-eks   "watches App CRDs to determine running state and route traffic to app pods"
apps-proxy -> azure-aks "watches App CRDs to determine running state and route traffic to app pods"
apps-proxy -> gcp-gke   "watches App CRDs to determine running state and route traffic to app pods"

# --- sandboxes-service-purge-app-runs ---
sandboxes-service-purge-app-runs -> mysql-instance-job-queue "deletes AppRun records completed more than 6 months ago"

# --- sandboxes-service-prune-app-run-logs ---
sandboxes-service-prune-app-run-logs -> mysql-instance-job-queue "prunes startup log data from AppRun records completed more than 7 days ago"

# --- sandboxes component (ephemeral job pod) ---
# Directly manages K8s resources (pods, services) using keboola/k8s-client
sandboxes-component -> aws-eks   "directly creates and manages sandbox/app pods via Kubernetes API"
sandboxes-component -> azure-aks "directly creates and manages sandbox/app pods via Kubernetes API"
sandboxes-component -> gcp-gke   "directly creates and manages sandbox/app pods via Kubernetes API"

# --- Pattern B: consumers read from subscriber-owned queues ---
sandboxes-service-messenger-consumer-connection-events    -> sqs-queue-sandboxes-service-connection-events        "consumes connection events on AWS stacks"
sandboxes-service-messenger-consumer-connection-events    -> servicebus-queue-sandboxes-service-connection-events "consumes connection events on Azure stacks"
sandboxes-service-messenger-consumer-connection-events    -> pubsub-sub-sandboxes-service-connection-events       "consumes connection events on GCP stacks"

sandboxes-service-messenger-consumer-connection-audit-log -> sqs-queue-sandboxes-service-connection-audit-log        "consumes connection audit log events on AWS stacks"
sandboxes-service-messenger-consumer-connection-audit-log -> servicebus-queue-sandboxes-service-connection-audit-log "consumes connection audit log events on Azure stacks"
sandboxes-service-messenger-consumer-connection-audit-log -> pubsub-sub-sandboxes-service-connection-audit-log       "consumes connection audit log events on GCP stacks"

# --- Pattern B: subscriber queues receive from Connection topics ---
sqs-queue-sandboxes-service-connection-events        -> sns-topic-connection-events        "subscribed via aws_sns_topic_subscription"
servicebus-queue-sandboxes-service-connection-events -> eventgrid-topic-connection-events  "subscribed via azurerm_eventgrid_event_subscription"
pubsub-sub-sandboxes-service-connection-events       -> pubsub-topic-connection-events     "subscribed via google_pubsub_subscription"

sqs-queue-sandboxes-service-connection-audit-log        -> sns-topic-connection-audit-log        "subscribed via aws_sns_topic_subscription"
servicebus-queue-sandboxes-service-connection-audit-log -> eventgrid-topic-connection-audit-log  "subscribed via azurerm_eventgrid_event_subscription"
pubsub-sub-sandboxes-service-connection-audit-log       -> pubsub-topic-connection-audit-log     "subscribed via google_pubsub_subscription"

# --- keboola-operator ---
# Runs INSIDE the cluster using in-cluster credentials (InClusterClientFacadeFactory).
# This is still an explicit application-level K8s API interaction -- the operator manages
# App, StorageToken, and E2bSandbox custom resources via controller-runtime.
# This is NOT the generic "runs-on" relationship -- it is the operator's raison d'être.
keboola-operator -> aws-eks    "manages App, StorageToken, E2bSandbox CRDs via controller-runtime (in-cluster)"
keboola-operator -> azure-aks  "manages App, StorageToken, E2bSandbox CRDs via controller-runtime (in-cluster)"
keboola-operator -> gcp-gke    "manages App, StorageToken, E2bSandbox CRDs via controller-runtime (in-cluster)"
keboola-operator -> kms-key-job-runner-aws    "decrypts app configuration secrets using job-runner KMS key on AWS stacks"
keboola-operator -> kms-key-job-runner-azure  "decrypts app configuration secrets using job-runner Key Vault key on Azure stacks"
keboola-operator -> kms-key-job-runner-gcp    "decrypts app configuration secrets using job-runner GCP KMS key on GCP stacks"
