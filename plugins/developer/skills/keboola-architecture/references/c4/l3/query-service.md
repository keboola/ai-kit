# query-service — dependency analysis

## Deployed components

All components use the same Docker image from `keboola/go-monorepo` (services/query/).
Each is a separate Deployment/CronJob differentiated by command args.

- `query-service-api` (Deployment): Go REST API. Accepts query requests, manages jobs via
  PostgreSQL queue. Serves at `query.{suffix}`. Port 8000.
- `query-service-coordinator` (Deployment): Coordinates query job distribution — monitors
  worker health via heartbeats, assigns queued jobs to available workers, handles session
  lifecycle. No external HTTP port.
- `query-service-worker` (Deployment): Executes SQL queries against Snowflake or BigQuery.
  Polls job queues from PostgreSQL, opens warehouse sessions, streams results back.
- `query-service-partition-maintenance` (CronJob, daily at midnight): Manages PostgreSQL
  table partitions for job history tables. Uses separate `/app/partition-maintenance` binary.
- `job-migrate` (Job, helm hook pre-install/pre-upgrade): Runs DB migrations. **Skipped**
  as a C4 component — deploy-time only.

## Inter-service dependencies

- All components -> `connection`: via `QUERY_STORAGE_API_HOST = connection.{suffix}`.
  Used by `PublicScope` (Storage API services map, stack features) and to verify tokens
  and retrieve workspace credentials (Snowflake account name, BigQuery project etc.).

## Storage backend dependencies

- `query-service-worker` -> `snowflake`: executes SQL queries directly against customer
  Snowflake accounts using workspace credentials retrieved from Connection.
- `query-service-worker` -> `bigquery`: executes SQL queries directly against customer
  BigQuery projects using service account credentials retrieved from Connection.

## Named cloud resource dependencies

| Resource ID | Type | Evidence |
|---|---|---|
| `rds-postgresql` | Shared PostgreSQL RDS | `QUERY_DB_*` injected from `kubernetes-postgresql-init` module; same shared RDS instance as kai-assistant apps. Database name: `query_service`. |

## Encryption

`QUERY_ENCRYPTION_AES_SECRET_KEY` (32-byte AES-256 key, base64) is injected via
`query-service-env-secrets` Kubernetes Secret. Used by `internal/encryption` package
(go-cloud-encrypt) to encrypt workspace credentials at rest in PostgreSQL.

This is **application-managed AES encryption** — NOT cloud KMS. No AWS KMS, Azure Key Vault,
or GCP Cloud KMS is involved. Do NOT add a cloud KMS resource relationship.

## Notes

- The coordinator and worker communicate exclusively via PostgreSQL queues (LISTEN/NOTIFY +
  partitioned job tables). No direct HTTP calls between components.
- `query-service-partition-maintenance` CronJob uses a separate binary
  (`/app/partition-maintenance`) but the same Docker image as the other components.
- The Terraform module has only a single cloud variant (no aws/azure/gcp subdirectory split)
  — it uses the shared PostgreSQL RDS which already exists on all clouds.
