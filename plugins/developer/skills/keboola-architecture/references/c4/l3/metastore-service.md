# metastore-service — dependency analysis

## Deployed components

- `metastore-api` (Deployment): Go REST API. Serves at `metastore.{suffix}`. Port 8000.
  Source: `go-monorepo/services/metastore`. Terraform exists (`app_metastore.tf`) but
  gated on `var.metastore_enabled` — implemented but not yet enabled on production stacks.

## Inter-service dependencies

- `metastore-api` -> `connection`: via `METASTORE_STORAGE_API_HOST = connection.{suffix}`.
  Used by `PublicScope` (services map) and `ProjectScope` (per-request token verification
  and project context resolution via Storage API).

## Named cloud resource dependencies

| Resource ID | Type | Evidence |
|---|---|---|
| `rds-postgresql` | Shared PostgreSQL RDS | `METASTORE_DB_*` injected from `kubernetes-postgresql-init` module; same shared RDS instance as query-service and kai-assistant apps. Database: `metastore_service`. |

## Notes

- Same Terraform pattern as query-service: single module variant (no aws/azure/gcp split),
  PostgreSQL credentials only, no cloud-specific resources.
- No KMS, no message queues, no object storage.
- `job-migrate` Job is a helm hook (pre-install/pre-upgrade) — deploy-time only, skipped.
- The service is fully implemented with migrations, repository layer, authz, and API;
  it is "uncommissioned" only in the sense that `metastore_enabled` defaults to false
  in production stack variables.
