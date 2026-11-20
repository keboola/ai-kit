# Run ledger

One row per component the skill has touched. A component stays open until
`component-facts.mjs` shows the live portal copy matching what was merged. A merge is not a
publish: the repo's `publish.trigger` says when the change reaches the Developer Portal.

| Date | Component | Bucket | Files | Proposal dir | PR | Merged | Published (`/v2/storage`) |
|---|---|---|---|---|---|---|---|
| 2026-08-19 | `kds-team.ex-hubspot-v2` | source/saas-api | configuration_description.md | archived outside the repo, operator's logs (2026-08-19) | none (soft gate: owner sign-off; repo keboola/component-hubspot-v2, trigger tag) | no | no |
| 2026-10-12 | `keboola.ex-langsmith-traces` | source/saas-api | component_short_description.md, component_long_description.md, configuration_description.md | archived outside the repo, operator's logs (2026-10-12) | none (hard gate: no component repo found; keboola-rnd/langsmith-trace-extractor now redirects to keboola/langsmith-trace-extractor, a library with no component_config/ and no workflows. Copy is portal-only; ask the owner) | no | no |
