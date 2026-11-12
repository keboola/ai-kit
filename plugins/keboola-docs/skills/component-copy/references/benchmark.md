# Benchmark (Fivetran, checked 2026-08-20)

The direct-competitor validation for this skill's design, useful when pitching the category
map to Matyáš (his 07-28 objection: one shape cannot fit the fleet). Fivetran's ~700
connectors prove the resolution: **one fixed skeleton, category adds depth — never shape**
(databases add replication internals, SaaS adds report schemas, files swap schema for config
options, all on the same H2 spine). Their setup guide is single-sourced — the same page
renders on the docs site and embedded in the product — which is this skill's core argument
(fix copy once in `component_config`, let the portal and UI render it). Copy their fixed
feature-vocabulary; avoid their three mistakes: blank cells instead of an explicit "No",
lifecycle badges visible only in the catalog and not on the page, and template-shell pages
padded to one sentence per section. Full write-up: vault `Competitor-doc-benchmarks.md`.
