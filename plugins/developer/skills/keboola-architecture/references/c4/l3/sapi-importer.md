# sapi-importer — dependency analysis

## Deployed components
- `sapi-importer-api` (Deployment): PHP REST API. Accepts file upload requests and imports them into Storage via the Storage API.

## Inter-service dependencies
- `sapi-importer-api` -> `connection`: `STORAGE_API_URL` via `App\StorageApi\ClientFactory` in services.yaml — all import operations go through the Storage API

## Named cloud resource dependencies
None. sapi-importer has no Terraform module and no infra_secrets. It has no database,
no KMS key, no queues, and no object storage of its own. All state is managed via
the Storage API (Connection).

## Unresolved
None.

## Notes
- `STORAGE_API_URL` is injected via ConfigMap (not infra_secrets) — derived from
  `hostnameSuffix` in values.yaml as `https://connection.{hostnameSuffix}`. This is
  invisible to Terraform-based scanning; must be found in the kbc-stacks ConfigMap template.
