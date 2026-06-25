# Development Workflow (Validate → Build → Verify)

**Use this when:** you're modifying an existing app and need a disciplined change loop.

## Prerequisite

First-time local-dev setup (install, run, secrets) lives in:
- [streamlit-apps.md](streamlit-apps.md) — Streamlit "Local development" section.
- [python-js-apps.md](python-js-apps.md) — Python/JS "Local development" section.

This reference assumes the local server is already running. The change loop below is for iterating on existing apps.

## Validate

### Semantic layer check (when available)

If the project has a semantic layer, check it **before** writing SQL. Most analytical apps benefit from grounding queries in shared metric / dataset definitions rather than reinventing the calculation.

1. `mcp__keboola__search_semantic_context(patterns=[...])` — find metrics, datasets, glossary terms matching the user's intent.
2. If something relevant exists: `mcp__keboola__get_semantic_context` to read the metric's SQL, the dataset's FQN, and the join paths between datasets.
3. Use those definitions **verbatim** — don't reinvent the calculation. If revenue is defined as `SUM(amount) / COUNT(DISTINCT customer_id)` in the semantic layer, that exact formula goes into the app's query.
4. `mcp__keboola__validate_semantic_query(semantic_model_id, sql, expected_semantic_objects=[...])` to catch mismatches against the semantic layer before embedding the SQL.
5. Only then run `mcp__keboola__query_data` to verify the query returns the expected shape (the standard validate step below).

If no semantic model exists, or none of the existing models matches the user's intent, say so explicitly and proceed with the standard validate steps below using raw tables.

### Schema and data validation

Before writing any code, use Keboola MCP to confirm assumptions about the data:

```text
mcp__keboola__get_project_info()
→ Returns SQL dialect (Snowflake / BigQuery), project metadata, available data sources.

mcp__keboola__get_table(table_id="out.c-analysis.usage_data")
→ Returns column names (exact case), data types, fully qualified table name for queries.

mcp__keboola__query_data(
    sql='SELECT DISTINCT "user_type", COUNT(*) FROM "KBC_REGION_PROJID"."out.c-analysis"."usage_data" GROUP BY "user_type"',
    query_name="Check user_type values",
)
→ Confirms distinct values, row counts, NULL handling. Use to validate the filter SQL before embedding it in code.
```

The query above uses Snowflake quoting. On a **BigQuery** project, write the same query with backticks per segment and the mangled dataset name (e.g. `` `out_c_analysis`.`usage_data` ``). See [storage-access.md](storage-access.md) §"BigQuery SQL dialect".

Sample sequence:

```text
1. get_project_info()                    → "Snowflake" dialect, double-quote identifiers
2. get_table("out.c-analysis.usage")     → "user_type" column exists, VARCHAR
3. query_data("SELECT DISTINCT user_type ...")
                                          → values: 'External User', 'Keboola User'
4. query_data("SELECT COUNT(*) FROM ... WHERE user_type = 'External User'")
                                          → 122 users, 3,151 events
```

Now you can write the filter code with confidence.

The validate step also catches:
- Wrong column names (case mismatch, typos).
- Wrong table names (bucket changes, branch differences).
- Empty filter results (you'd build the UI for data that doesn't exist).
- Wrong SQL dialect (`||` vs `+` for concatenation; BigQuery backticks vs Snowflake double-quotes).

## Build

With validated data, write code following these rules:

- **SQL-first** — push aggregations to the database (see [dashboard-patterns.md](dashboard-patterns.md)).
- **Centralized data access** — all queries go through `utils/data_loader.py` (Streamlit) or `api/queries.js` (Node). Never inline a raw query in a page module.
- **Initialize session state with defaults** before creating widgets:
  ```python
  if 'filter_name' not in st.session_state:
      st.session_state.filter_name = 'default_value'
  ```
- **No variable-name conflicts** — don't use the same name for a SQL filter clause and a UI widget value (one is a string, the other is a list). Rename one — e.g. `user_type_sql_filter` vs `user_type_multiselect`.
- **Quote all identifiers in Snowflake SQL** — `"column_name"` not `column_name`. Unquoted may fail due to case sensitivity.

## Verify

After making changes, verify visually. Required when Playwright MCP is available.

```text
1. Confirm app is running:
   Bash: lsof -ti:8501   (Streamlit) or :3000 (Node) or :5000 (Flask)
   If not running: start it locally (see streamlit-apps.md / python-js-apps.md).

2. Navigate:
   mcp__playwright__browser_navigate(url="http://localhost:8501")
   mcp__playwright__browser_wait_for(time=3)

3. Baseline screenshot:
   mcp__playwright__browser_take_screenshot(filename="01-baseline.png")

4. Test the change:
   - Click the new filter / button / link.
   - mcp__playwright__browser_wait_for(time=2)
   - mcp__playwright__browser_take_screenshot(filename="02-after-click.png")
   - Verify the expected metrics changed.

5. Navigate through affected pages:
   For each page in the dashboard, navigate, wait, screenshot, verify no errors.

6. Check console:
   mcp__playwright__browser_snapshot()
   → review accessibility tree and any error indicators.
```

If Playwright MCP is NOT available (e.g. Claude Desktop without it), call out explicitly that visual verification was skipped, and ask the user to verify the change manually before committing.

## Checklist

Use this condensed checklist before considering a change complete:

**Validate**
- [ ] Project info retrieved (SQL dialect confirmed)
- [ ] Table schema checked (column names + types verified)
- [ ] Sample data queried (filter values, row counts, NULL behavior confirmed)
- [ ] SQL filter conditions tested with `query_data` before embedding

**Build**
- [ ] Code follows SQL-first (aggregation in DB, not Python)
- [ ] All queries route through the data-access module
- [ ] Session state initialized with defaults
- [ ] No variable-name conflicts (SQL clause vs UI widget)
- [ ] Quoted identifiers in SQL
- [ ] Import statements updated for any new helpers

**Verify**
- [ ] App running locally
- [ ] Browser navigation succeeds
- [ ] Baseline + after-change screenshots captured
- [ ] All affected pages navigated through
- [ ] No errors in UI or console
- [ ] Metrics show expected values (compared against the validate-step queries)

**Commit prep**
- [ ] No secrets in code (`.streamlit/secrets.toml` not staged)
- [ ] No debug prints / commented-out code
- [ ] Commit message describes the WHY, not just the what
