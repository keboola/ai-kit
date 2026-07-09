---
name: semantic-layer-usage
description: Use when building an app, query, report, or transformation from a Keboola semantic layer / semantic model, or right after a semantic-context tool returns. The semantic layer is a LOGICAL model — its entity/metric/field names are NOT guaranteed to match physical table/column identifiers. Resolve each logical object to its physical Storage identifier and confirm real columns before writing any SQL.
---

# Using the Keboola semantic layer safely

The semantic layer is a **logical model**. It describes metrics, entities, and
fields in business terms and stores the *definition* of a calculation (its SQL,
the dataset it belongs to, the join paths between datasets). It is **not** a
guarantee about physical Storage naming: a semantic field called `total_revenue`
or an entity called `Trips` will frequently **not** exist under that name as a
physical column or table. The mapping between logical and physical is exactly
what you must resolve — never assume it.

Trusting logical names as if they were physical identifiers is the single most
common way a semantic-layer-backed app ships broken: the SQL references columns
that don't exist, every query errors or returns empty, and the app renders a
blank or error screen.

## Mandatory verification loop — before writing ANY SQL/query

Do this for **every** logical object you plan to touch. Do not skip it because
the names "look obvious".

**Step 1 applies only when a semantic layer/model is present. Steps 2–4 are the
floor and always apply** — whether you started from a semantic model, a bare
Storage table, or a user's business-language request. If no semantic model
exists (or none matches the request), say so and go straight to steps 2–4
against the raw tables.

1. **(If a semantic model is available) Read the semantic definition.**
   `mcp__keboola__search_semantic_context` to find the relevant
   metric/entity/dataset, then `mcp__keboola__get_semantic_context` to read its
   SQL, the dataset's identifier, and join paths. Use the metric's calculation
   **verbatim** — don't reinvent it. If nothing relevant is returned, treat the
   source as raw Storage and continue with steps 2–4.
2. **Resolve to physical Storage identifiers.** Map each logical dataset/entity
   (or the user's described table) to a real bucket + table with
   `mcp__keboola__get_buckets` → `mcp__keboola__get_tables`, then
   `mcp__keboola__get_table(table_id=...)` for the chosen table. `get_table`
   returns the **exact column names** (with case), data types, and the
   `fully_qualified_name` / `fqn` to use in queries.
3. **Confirm column names.** Match every field you plan to select to a real
   column from `get_table`. If a semantic field has no obvious physical column,
   it is derived — read the semantic SQL to see how it's computed; do not guess
   a column name.
4. **Probe before committing.** Run a cheap `mcp__keboola__query_data` probe —
   `SELECT <cols> FROM <fqn> LIMIT 1` — against the resolved physical identifiers
   to prove the table, columns, and quoting are correct **before** you write them
   into app, transformation, or report code.

Write the real query only after the applicable steps pass. When you did start
from a semantic model and the project exposes
`mcp__keboola__validate_semantic_query`, run it too — it catches mismatches
against the semantic model before the SQL is embedded.

## Use fully-qualified physical identifiers, exactly as returned

Write queries with the exact identifier string from `get_table`, never a
hand-derived one:

- **Snowflake** — full 3-part FQN with double quotes:
  `"KBC_REGION_PROJID"."out.c-nyc-aggregations-duckdb"."rpt_daily"`. The database
  prefix is required; without it Data Catalog / linked tables won't resolve.
- **BigQuery** — backticked 2-part `` `dataset`.`table` `` where the `in`/`out`
  stage is baked into the mangled dataset name (e.g. `` `out_c_nyc_aggregations_duckdb`.`rpt_daily` ``).

This is the same FQN rule the `dataapp-development` skill's
`references/storage-access.md` documents for data-app queries — the logical name
from the semantic layer is never a substitute for it.

## Worked example — the failure this skill prevents

A user asked Kai to build a dashboard **from the semantic layer** over
`out.c-nyc-aggregations-duckdb.rpt_*` tables. Kai read the semantic context and
wrote the dashboard SQL using the **semantic-model field names** directly, never
calling `get_table` to check the physical schema. Those field names did not match
the physical columns of the `rpt_*` tables, so every query failed — the dashboard
rendered empty even though the container was "running", and Kai reported success
without verifying.

What should have happened:

```text
search_semantic_context(patterns=["nyc trips", "daily revenue"])
  → metric "daily_revenue", dataset backed by out.c-nyc-aggregations-duckdb
get_semantic_context(...)               → metric SQL + dataset identifier + joins
get_buckets / get_tables                → out.c-nyc-aggregations-duckdb → rpt_daily
get_table(table_id="out.c-nyc-aggregations-duckdb.rpt_daily")
  → real columns: pickup_date, fare_total, trip_count  (NOT the semantic labels)
  → fully_qualified_name for the query
query_data('SELECT "pickup_date","fare_total" FROM "<DB>"."out.c-nyc-aggregations-duckdb"."rpt_daily" LIMIT 1')
  → confirms table + columns + quoting before any dashboard code is written
```

The logical field the user thinks in ("revenue") maps to a physical column
(`fare_total`) that you can only know by resolving it. Resolve first, query
second.

## Related

- `dataapp-development` skill — full app lifecycle; its `references/dev-workflow.md`
  covers the validate-first loop and `references/storage-access.md` covers FQN
  quoting per backend. Load this skill alongside it when the data source is a
  semantic model.
