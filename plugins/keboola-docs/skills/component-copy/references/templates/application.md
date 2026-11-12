# Template: application (`application` bucket)

**Status: stub.** Applications (44 public components: AI, triggers, custom Python, Data
Gateway, notifications) are not templated in the first cut; their copy is hand-written. This
file holds the shape agreed so far so a new application starts from something, and so the
engineering toolkit gets a template for every bucket. Confirm or replace with the owner before
running it on the fleet.

## component_short_description.md

One sentence on the service or the job the application does for the reader, not on the
component: "Trigger a dbt Cloud job and wait for its result", not "This application triggers…".

## component_long_description.md

What it takes in (tables, files, nothing), what it does, what it leaves behind (tables, files,
a side effect in another system), what credentials it needs. Links to the service's docs.
No configuration steps, no images. When the application talks to an external service, give its
README the same `## Prerequisites` section as `source.md` (recommended here; the linter requires
it only for connectors).

## configuration_description.md

Optional; leave it empty unless it already has text (the owner would rather remove the field from
the UI, 2026-11-12). Existing text covers only what the form does not make obvious: order of
operations, side effects on the external system, what a failed run leaves behind. Starts with a
sentence; `###`/`####` only; no images.

## configSchema.json / configRowSchema.json

Same field rules as `source.md` (titles, descriptions, tooltips, documentation links,
enum_titles), with one addition: a field that triggers an action in another system says so in
its tooltip.

## documentationUrl.md

Same as `source.md`.
