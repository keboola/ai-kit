# templates-api — dependency analysis

## Deployed components
- `templates-api` (Deployment): Go REST API. Applies configuration templates to Keboola projects.
  Built from `cmd/templates-api/main.go` in `keboola-as-code` monorepo.
- `templates-api-etcd` (Bitnami etcd sub-chart, 3 replicas): Self-hosted etcd cluster deployed
  as a Helm sub-chart within the templates-api release. Used for distributed locking to ensure
  atomicity of write operations. Runs in the `templates-api` namespace.

## Inter-service dependencies
- `templates-api` -> `connection`: `TEMPLATES_STORAGE_API_HOST` =
  `https://connection.{hostnameSuffix}` from ConfigMap (via `_helpers.tpl`). Used to verify
  tokens, read project configurations, and write template-applied configurations back to Storage.

## External dependencies (outside keboolaPlatform)
- `templates-api` -> GitHub (`github.com/keboola/keboola-as-code-templates.git`): The API
  clones Git repositories at runtime to read template definitions.
  Default repos: `keboola` (main), `keboola-beta` (beta), `keboola-dev` (dev),
  plus `ComponentsTemplateRepositoryURL` (main+beta branches).
  Source: `DefaultTemplateRepositoryURL` in `internal/pkg/template/repository/default.go`.

## Named cloud resource dependencies
None. No Terraform module for templates-api.

## Unresolved
None.

## Notes
- `TEMPLATES_STORAGE_API_HOST` is injected via ConfigMap (not infra_secrets) — derived from
  `hostnameSuffix` in values.yaml. Invisible to Terraform-based scanning.
- etcd is bundled as a Helm sub-chart (Bitnami), not a separate kbc-stacks app. It is
  self-hosted infrastructure co-deployed with the templates-api, not a managed cloud service.
  etcd availability is not critical — the API degrades gracefully without it (loses atomicity).
- GitHub access at runtime is a notable architectural dependency not visible from Terraform or
  kbc-stacks — the API actively clones public GitHub repos to read template definitions.
