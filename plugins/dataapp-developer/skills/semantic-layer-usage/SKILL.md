---
name: semantic-layer-usage
description: Use right after a Keboola semantic-context tool returns, when building an app, query, report, or transformation from a semantic model. Ground the SQL in the model's own physical mapping (dataset `tableId`/`fqn`, metric SQL) and confirm the real columns before writing any query — do not build SQL from the business-facing display names.
---

# Using the Keboola semantic layer safely

The Keboola MCP system prompt already documents the semantic-layer workflow
(discover with `search_semantic_context`, inspect with `get_semantic_context`,
`validate_semantic_query`, then `query_data`). This skill adds the one failure
mode that workflow does not spell out.

**The semantic layer already carries the physical mapping — use it, don't
bypass it.** A `semantic-dataset` returns its `tableId` and `fqn`; a
`semantic-metric` returns its SQL. The business-facing display names (a field
labelled `Total Revenue`, an entity `Trips`) are *not* the physical columns —
they are labels on top of the definition. The failure is writing SQL from those
labels instead of from the definition the tools already gave you.

## The one rule

Before you embed any SQL into app, transformation, or report code, confirm the
real column names against Keboola MCP — e.g. `get_table` on the dataset's
`tableId` — and use the metric's SQL verbatim rather than reinventing it. If
`search_semantic_context` returns nothing relevant, there is no model to
consult: say so and work against raw Storage. How you batch those checks is up
to you.

## Worked example — the failure this skill prevents

A user asked Kai to build a dashboard from the semantic layer over
`out.c-nyc-aggregations-duckdb.rpt_*` tables. Kai read the semantic context but
wrote the dashboard SQL from the **semantic display names**, never confirming
the physical columns. They didn't match the `rpt_*` schema, so every query
failed: the dashboard rendered empty even though the container was "running",
and Kai reported success without verifying.

What grounds it instead:

```text
search_semantic_context(patterns=["nyc trips", "daily revenue"])
  → metric "daily_revenue", dataset with tableId out.c-nyc-aggregations-duckdb.rpt_daily
get_semantic_context(...)  → metric SQL + dataset tableId + fqn (the physical mapping)
get_table(table_id="out.c-nyc-aggregations-duckdb.rpt_daily")
  → real columns: pickup_date, fare_total, trip_count  (NOT the display labels)
```

The label the user thinks in ("revenue") is the physical column `fare_total`;
the semantic definition tells you that — read it instead of guessing.

## Related

- `dataapp-development` skill — full app lifecycle; its
  `../dataapp-development/references/storage-access.md` covers FQN quoting per backend and
  `../dataapp-development/references/dev-workflow.md` covers the validate-first loop. Load this skill
  alongside it when the data source is a semantic model.
