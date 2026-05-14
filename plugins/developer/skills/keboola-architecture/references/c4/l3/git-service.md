# git-service — dependency analysis

## Deployed components

- `git-service-api` (Deployment): Go REST API wrapping Forgejo. Serves at `git-service.{suffix}`.
  Port 8082. Single Deployment; no CronJobs, no workers.
  Source: `go-monorepo/services/git-service`. Not yet fully commissioned.

## Inter-service dependencies

- `git-service-api` -> `connection`: via `GIT_SERVICE_MANAGE_API_URL` (internal cluster URL
  `http://connection-api.connection.svc.cluster.local`). Uses the Manage API to verify tokens
  and read project/organization context.
- `git-service-api` -> `forgejo`: via `GIT_SERVICE_FORGEJO_URL` (internal cluster URL
  `http://forgejo-http.forgejo.svc.cluster.local:3000`). Manages Git repositories in the
  self-hosted Forgejo instance using an admin token.

## Named cloud resource dependencies

None. No database, no object storage, no KMS, no message queues.

## Notes

- No Terraform module exists yet (`app_forgejo.tf` and `app_git_service.tf` absent from
  `aws/stage-30/`). Confirms uncommissioned status.
- `forgejo` is a self-hosted Git service deployed via the upstream Bitnami/Forgejo Helm chart
  (v17). It is modelled as a separate `SelfHosted` container — like Elasticsearch — because it
  is independently deployed and not co-located with git-service.
