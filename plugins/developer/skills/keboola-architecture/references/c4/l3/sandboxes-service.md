# sandboxes — dependency analysis

## Deployed components

### sandboxes-service (PHP/Symfony, repo: keboola/sandboxes-service)

- `sandboxes-service-api` (Deployment): PHP/Symfony REST API served by RoadRunner.
  Central API for Workspaces (Python/R sandboxes) and Apps (Data Apps). Serves at
  `data-science.{suffix}`. Manages sandbox lifecycle, app provisioning strategies,
  and app proxy configuration.

- `sandboxes-service-garbage-collector` (CronJob, every 15min): Cleans up orphaned
  K8s resources (pods, PVCs, persistent storages). Reads DB, calls K8s API directly.

- `sandboxes-service-messenger-consumer-connection-events` (Deployment): Symfony
  Messenger consumer. Receives Connection events (Pattern B fan-out from Connection
  events topic). Handles project/workspace lifecycle events.

- `sandboxes-service-messenger-consumer-connection-audit-log` (Deployment): Symfony
  Messenger consumer. Receives Connection audit log events (Pattern B fan-out).

- `sandboxes-service-sync-app-runs-watch` (Deployment): Watches K8s AppRun CRDs and
  syncs their state back to sandboxes-service database.

- `sandboxes-service-suspend` (CronJob): Suspends idle apps and sandboxes.
  Reads app records from MySQL, lists running App CRDs from K8s, transitions expired
  apps to stopped state. Uses `StorageApiTokenProvider` to retrieve provisioning tokens
  from Connection. Dependencies: MySQL + K8s API + Connection.

- `sandboxes-service-purge-app-runs` (CronJob): Deletes AppRun records completed
  more than 6 months ago. MySQL only (`AppRunRepository::purgeAppRunsCompletedBefore`).

- `sandboxes-service-prune-app-run-logs` (CronJob): Nulls startup log fields on AppRun
  records completed more than 7 days ago. MySQL only
  (`AppRunRepository::pruneLogsFromAppRunsCompletedBefore`).

- `sandboxes-service-db-migration` (Job, helm hook): DB migrations. Skipped — deploy-time only.

### apps-proxy (Go, repo: keboola/keboola-as-code, cmd/apps-proxy)

- `apps-proxy` (Deployment): Go reverse proxy for Data Apps. Routes incoming HTTP
  requests to the correct app pod via K8s. Authenticates users via sandboxes-service.
  Only used for Apps, not Sandboxes. Has an E2B webhook forwarding endpoint.

### keboola-operator (Go, repo: keboola/keboola-operator)

- `keboola-operator-controller-manager` (Deployment): Kubernetes operator managing
  custom resources: `App`, `StorageToken`, `E2bSandbox` CRDs. Provisions and
  lifecycle-manages App pods in the K8s cluster. Handles E2B sandbox CRDs.
  Decrypts app configuration using ObjectEncryptor (job-runner KMS key).

### sandboxes component (PHP, repo: keboola/sandboxes)

Runs as ephemeral job pods via the job-queue infrastructure (not a persistent service).
This is a Keboola component (keboola.sandboxes) that abuses the job-queue runner
mechanism to perform asynchronous K8s operations. Receives jobs from UI via
connection → queue → job-runner path. Manages sandbox/app K8s resources directly.
Being phased out for Apps (replaced by operator), remains standard path for Workspaces.

## Inter-service dependencies

### sandboxes-service-api
- `connection`: via `getConnectionServiceUrl()` — Storage API (token verify, workspace
  credentials, project context) + Manage API (`Keboola\ManageApi\Client`)
- `billing`: via `getBillingServiceUrl()` — `Keboola\BillingApi\ClientFactory`
  (`BILLING_ENABLED` flag; still model)
- `encryption`: via `getEncryptionServiceUrl()` — `EncryptionClientFactory` for
  app proxy auth config decryption
- `git-service`: hardcoded cluster URL
  `http://git-service.git-service.svc.cluster.local` for git repository management

### sandboxes-service-garbage-collector
- `connection`: via ServiceClient (same URL as api)
- K8s API: deletes orphaned pods and PVCs

### sandboxes-service-suspend
- `connection`: via `StorageApiTokenProvider` — retrieves provisioning tokens for
  transitioning app state (e.g. stopping an expired app via operator strategy)
- K8s API: lists running App CRDs, transitions their desired state

### sandboxes-service-messenger-consumer-connection-events
- `connection`: receives Connection events (Pattern B async)

### sandboxes-service-messenger-consumer-connection-audit-log
- `connection`: receives Connection audit log events (Pattern B async)

### sandboxes-service-purge-app-runs
- MySQL only: deletes old AppRun records. No inter-service calls.

### sandboxes-service-prune-app-run-logs
- MySQL only: prunes log data from AppRun records. No inter-service calls.

### sandboxes-service-sync-app-runs-watch
- K8s API only (watches AppRun CRDs) — no inter-Keboola-service calls

### apps-proxy
- `sandboxes-service-api`: via `APPS_PROXY_SANDBOXES_API_URL` + `APPS_PROXY_SANDBOXES_API_TOKEN`
  (app config, auth, routing decisions). Note: relationship is to the component, not the
  container — Structurizr prohibits parent-child relationships.

### keboola-operator
- `connection`: via `APPLICATION_TOKEN` — Storage API token used to authenticate
  operator actions (workspace/token provisioning)
- `e2b`: via `E2B_API_KEY` — manages E2B sandboxes for E2bSandbox CRDs

### sandboxes component (ephemeral job pod)
- `connection`: via `keboola/storage-api-client` (Storage API, input/output mapping)
- `sandboxes-service-api`: via `keboola/sandboxes-service-api-client`

## Named cloud resource dependencies

| Resource | Type | Evidence |
|---|---|---|
| `mysql-instance-job-queue` | MySQL | `mysql_config = local.job_queue_mysql_config` in stack-level tf. Used by api, gc, suspend, purge, prune. |
| `kms-key-job-runner-aws/azure/gcp` | Shared KMS | `AWS_KMS_KEY_ID_JOB_QUEUE` / `AZURE_KEY_VAULT_URL_JOB_QUEUE` / `GCP_KMS_KEY_ID_JOB_QUEUE`. Used by `app.object_encryptor.job_queue` to **decrypt** app OAuth/config secrets that were **encrypted by the job-queue component** using this shared key. Also used by keboola-operator for the same purpose. |
| `kms-key-sandboxes-service-aws/azure/gcp` | Service-owned KMS | `AWS_KMS_KEY_ID_INTERNAL` (`aws_kms_key.sandboxes_service`). Used by `app.object_encryptor.internal` for sandboxes-service's own internal encryption (e.g. operator provisioning strategy). |
| `sqs-queue-sandboxes-service-connection-events` | SQS (Pattern B) | `aws_sqs_queue.connection_events` + `aws_sns_topic_subscription` → `connection_events_topic_arn` |
| `sqs-queue-sandboxes-service-connection-audit-log` | SQS (Pattern B) | `aws_sqs_queue.connection_audit_log` + `aws_sns_topic_subscription` → `connection_audit_log_topic_arn` |
| `aws-eks` / `azure-aks` / `gcp-gke` | K8s cluster | `Keboola\K8sClient` + `KubernetesApiFacade` — used by api, gc, and suspend |

## Provisioning paths summary

| Product | Standard path | Secondary / phasing in | Uncommissioned |
|---|---|---|---|
| Workspaces (Python/R) | sandboxes component via job-queue | operator (phasing in) | — |
| Apps | operator | sandboxes component (phasing out) | E2B |

## Notes

- `sandboxes-api` repo (`keboola/sandboxes-api`) is removed — do not reference it.
- SQL Workspaces are exclusively managed by `editor-service`, not sandboxes.
- `apps-proxy` is in `keboola-as-code` monorepo under `cmd/apps-proxy`. It is a
  component of the `sandboxes` C4 container.
- `keboola-operator` has no Terraform module at
  `infrastructure/terraform/modules/app-keboola-operator/`. Config injected entirely
  via kbc-stacks `secret-config.yaml`.
- EFS/ABS/GCS persistent storage resources for Workspaces are cluster infrastructure,
  not service-owned app resources — not modelled as named C4 resources.
- **Why job-runner KMS key in sandboxes-service?** App configurations can contain OAuth
  credentials or other secrets. When those configs are created via the job-queue
  component (keboola.sandboxes), they get encrypted with the shared job-runner KMS key.
  When sandboxes-service later needs to inject those secrets into app pods (e.g. for
  app proxy auth), it must decrypt them — requiring the same key. This is a
  cross-service decrypt dependency, not sandboxes-service doing its own encryption.
