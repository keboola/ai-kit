# api-service — dependency analysis

## Deployed components

- `api-portal` (Deployment): Static React SPA (Vite build) serving OpenAPI documentation
  for all platform services. Rendered in the browser using RapiDoc. Hosted at
  `api.{suffix}`. Single replica, no health dependencies.

## Inter-service dependencies

**None at runtime.** The API Portal is a fully static SPA. All content is pre-built
into the Docker image at CI time.

## Build-time collector (not a runtime dependency)

The `collector/collect.js` script runs as `npm run collect` during the Docker image build.
It fetches OpenAPI spec files from live service endpoints (defined in `src/config.json`
as `openApiUrl`) and writes them to `public/specs/`. These become static assets bundled
into the image. The collector calls one reference stack (north-europe.azure.keboola.com
or us-east4.gcp.keboola.com) per service — these are **build-time** HTTP calls, not
runtime dependencies.

Services with specs collected (from config.json): ai, billing, editor, encryption,
import, job-queue, manage, notification, oauth, query, sandboxes-service, scheduler,
stream, sync-actions, templates, vault. Storage API has no openApiUrl (skipped).

## Named cloud resource dependencies

None.

## Notes

- No Terraform module, no infra secrets, no database.
- Stack filtering is client-side: `config.json` maps hostnames to excluded services,
  and the browser filters the service selector dropdown accordingly.
- The `storage` service entry has an empty `openApiUrl` and is skipped by the collector.
  Its docs are not served by the portal.
