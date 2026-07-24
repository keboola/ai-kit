---
name: duckdb-transformation
description: >
  Expert knowledge for writing, optimizing, and migrating DuckDB transformations in Keboola.
  Covers SQL dialect, block orchestration, dynamic backends, Parquet format, case sensitivity,
  Snowflake-to-DuckDB migration, type casting patterns, and best practices.
  Use when the user is writing DuckDB SQL, migrating from Snowflake, debugging DuckDB transformations,
  or needs guidance on DuckDB-specific syntax and configuration in Keboola.
version: 1.0.0
---

# DuckDB Transformation Knowledge

Provide expertise on writing, configuring, and optimizing DuckDB transformations in Keboola Connection.

## Overview

DuckDB (`keboola.duckdb-transformation`) is an in-process analytical database (OLAP) with columnar storage,
designed for fast SQL analytics. It is a cost-effective alternative to Snowflake for small-to-medium datasets.

**Status:** BETA --- breaking changes may occur.

**Key advantages:**
- In-process execution (no external database server)
- Columnar storage optimized for analytical queries
- Block-based orchestration with automatic dependency analysis
- Parallel execution of independent scripts
- Rich SQL dialect with modern quality-of-life extensions

## Configuration

### Component ID

`keboola.duckdb-transformation`

### Configuration Structure

```json
{
  "parameters": {
    "blocks": [
      {
        "name": "Block Name",
        "codes": [
          {
            "name": "Script Name",
            "script": [
              "CREATE TABLE \"output\" AS",
              "SELECT * FROM \"input_table\";"
            ]
          }
        ]
      }
    ],
    "threads": 4,
    "max_memory_mb": 2048,
    "image_tag": "parquet",
    "dtypes_infer": false
  },
  "storage": {
    "input": {
      "tables": [
        {
          "source": "in.c-bucket.table",
          "destination": "input_table"
        }
      ]
    },
    "output": {
      "tables": [
        {
          "source": "output",
          "destination": "out.c-bucket.result"
        }
      ]
    }
  }
}
```

### Settings

- **Timeout** --- maximum execution time (default: 1 hour)
- **Backend size** --- memory allocation (see Dynamic Backends)
- **DuckDB version** --- `latest` (default) or pinned (e.g., `1.5.2`, `1.4.4`)
- **Automatic data types** --- auto-assign types to output tables
- **Use parquet for input tables** --- Parquet instead of CSV (recommended for >1 GB)
- **Infer input table data types** --- infer types from input tables (useful for non-typed Storage)
- **Debug mode** --- enable debug logging

## Block-Based Orchestration

- **Blocks** execute **sequentially** (one after another)
- **Scripts** within a block execute **in parallel** (when no dependencies)
- Uses [SQLGlot](https://github.com/tobymao/sqlglot) for automatic SQL analysis
- Builds a **DAG** (Directed Acyclic Graph) of dependencies
- Execution order is automatically optimized

## Dynamic Backends

| Backend Size | Memory | Recommended For |
|---|---|---|
| **XSmall** | 8 GB | Small datasets, testing |
| **Small** *(default)* | 16 GB | Most use cases |
| **Medium** | 32 GB | Large datasets (5 GB+) |
| **Large** | 113.6 GB | Very large datasets (10 GB+) |

Start with Small, scale up as needed. Dynamic backends are **not available** on Free/Pay As You Go plans.

DuckDB automatically detects available CPU and memory. Manual override via `threads` and `max_memory_mb` parameters.

## Parquet Format

Enable Parquet for significantly better performance with large datasets:
- Faster processing than CSV
- Lower memory usage
- Columnar storage optimized for analytics

**Recommendation:** Always use Parquet for datasets > 1 GB.

Configuration: set `"image_tag": "parquet"` or toggle **Use parquet for input tables** in UI.

## Infer Input Table Data Types

Keboola Storage tables can be non-typed (all columns as `VARCHAR`). When enabled, DuckDB infers
actual types (`INTEGER`, `FLOAT`, `DATE`, etc.) so aggregate functions and type-specific operations
work without manual casting.

Without inference: `SUM("amount")` fails because `amount` is `VARCHAR`.
With inference: `SUM("amount")` works because DuckDB detects it as numeric.

## Sync Actions

Four debugging actions available without running the full transformation:

1. **`syntax_check`** --- validate SQL syntax without execution
2. **`lineage_visualization`** --- markdown diagram of data dependencies
3. **`execution_plan_visualization`** --- planned execution order with blocks and batches
4. **`expected_input_tables`** --- list of expected input tables based on SQL analysis

## SQL Writing Rules

### Semicolons Between Statements

Each SQL statement **MUST be terminated with a semicolon** (`;`). Multiple statements in a single
script must be properly separated:

```sql
-- Correct: each statement ends with a semicolon
CREATE TABLE "output_a" AS SELECT * FROM "input_a";

CREATE TABLE "output_b" AS SELECT * FROM "input_b";
```

Missing semicolons cause syntax errors.

### Case Sensitivity (CRITICAL)

**Table names:**
- Unquoted → **lowercase** (`MyTable` → `mytable`)
- Quoted → **case-sensitive** (`"MyTable"` stays `MyTable`)

**Column names:**
- **Always case-sensitive** regardless of quoting
- `SELECT columnName` and `SELECT ColumnName` refer to **different columns**

This is different from Snowflake (unquoted → uppercase, quoted columns case-insensitive).

**Best practice:** Use consistent lowercase naming or always quote identifiers.

### Type Casting Patterns

For non-typed Storage tables, use safe casting patterns:

```sql
-- Safe: handles empty strings without errors
TRY_CAST(NULLIF("column", '') AS DATE)
TRY_CAST(NULLIF("column", '') AS DOUBLE)
TRY_CAST(NULLIF("column", '') AS INT)

-- Shorthand type cast
"column"::BOOLEAN
"column"::INTEGER

-- Regular cast
CAST("column" AS DECIMAL)
```

**Pattern:** `TRY_CAST(NULLIF("col", '') AS TYPE)` --- converts empty strings to `NULL` before
casting, avoiding errors on empty values.

### DuckDB SQL Extensions

Quality-of-life extensions not available in all SQL dialects:

```sql
-- GROUP BY ALL: auto-groups by all non-aggregated columns
SELECT product, category, SUM(sales) FROM orders GROUP BY ALL;

-- EXCLUDE: select all columns except specific ones
SELECT * EXCLUDE (password, ssn) FROM users;

-- ASOF JOIN: time-series data with non-matching timestamps
SELECT s.player_id, s.score, w.temperature
FROM scores s ASOF JOIN weather w ON s.score_time >= w.timestamp;

-- SUMMARIZE: quick data profiling
SUMMARIZE SELECT * FROM my_table;
```

### Memory Management for Large Datasets

For datasets > 10 GB, configure on-disk processing:

```sql
PRAGMA memory_limit='8GB';
PRAGMA temp_directory='/tmp/duckdb_temp';
PRAGMA threads=4;
PRAGMA enable_object_cache;
```

## Snowflake to DuckDB Migration

### Data Type Mapping

| Snowflake | DuckDB | Notes |
|---|---|---|
| `VARIANT` | `JSON` or `VARCHAR` | Semi-structured data |
| `ARRAY` | `LIST` | Native arrays |
| `OBJECT` | `STRUCT` or `JSON` | Nested objects |
| `INTEGER` | `INTEGER` | Same |
| `VARCHAR` | `VARCHAR` | Same |
| `TIMESTAMP` | `TIMESTAMP` | Same |

### SQL Function Differences

| Category | Snowflake | DuckDB |
|---|---|---|
| Window functions | `QUALIFY ROW_NUMBER() OVER (...) = 1` | Subquery with `WHERE rn = 1` |
| Null handling | `NVL(a, b)` | `COALESCE(a, b)` |
| Conditionals | `IFF(cond, a, b)` | `CASE WHEN cond THEN a ELSE b END` |
| Date add | `DATEADD(day, 7, date)` | `date + INTERVAL '7 days'` |
| Date diff | `DATEDIFF(day, d1, d2)` | `date_diff('day', d1, d2)` |
| String agg | `LISTAGG(...) WITHIN GROUP (ORDER BY ...)` | `STRING_AGG(...)` |
| Transient tables | `CREATE TRANSIENT TABLE` | Not supported (use regular or TEMP) |

### Case Sensitivity Migration

**Snowflake:**
- Unquoted → **UPPERCASE** (`MyTable` → `MYTABLE`)
- Quoted → case-sensitive (`"MyTable"` ≠ `"MYTABLE"`)

**DuckDB:**
- Unquoted → **lowercase** (`MyTable` → `mytable`)
- Quoted tables → case-sensitive
- Columns → **always case-sensitive** regardless of quoting

**Migration tip:** Use consistent lowercase naming: `CREATE TABLE mytable ...`

### Window Functions Migration

```sql
-- Snowflake
SELECT * FROM table QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY date DESC) = 1;

-- DuckDB
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY date DESC) AS rn
    FROM table
) WHERE rn = 1;
```

### Temporary Table Differences

- **Snowflake:** Temp tables can be in any schema
- **DuckDB:** Temp tables ALWAYS in `temp.main` schema (cannot specify another)
- **Both:** Auto-drop after session end
- **DuckDB name collision:** Temp table has priority over regular table with same name.
  Access regular table via `memory.main.table_name`

### Automatic Migration

[SQLGlot](https://github.com/tobymao/sqlglot) can automatically convert ~85% of Snowflake SQL
to DuckDB syntax. However, complex queries, Snowflake-specific functions, and edge cases may not
convert correctly.

**Transformation Migration Component** (`keboola.app-transformation-migration`):
- Experimental component that automates Snowflake → DuckDB migration
- Handles SQL dialect translation via SQLGlot
- Preserves input/output table mappings and runtime settings
- If translation fails for a code block, original SQL is preserved as comments

**Important:** The automatic migration is **not 100% accurate**. Roughly **25% of migrated
transformations will require manual adjustments** --- typically:
- Case sensitivity issues
- Unsupported Snowflake-specific functions
- Data type differences
- Column alias handling in GROUP BY

Always review and test migrated configurations before using in production.

### Functions That Work the Same

- `SUBSTRING(str, start, len)`
- `POSITION('x' IN str)`
- `CONCAT(a, b)` (both handle NULL gracefully)
- `a || b` (both return NULL if any input is NULL)
- `LIMIT n`
- `FETCH FIRST n ROWS`
- `CREATE TEMP TABLE` / `CREATE TEMPORARY TABLE`
- `CREATE OR REPLACE TABLE`
- `CREATE TABLE IF NOT EXISTS`
- `CREATE TABLE AS SELECT` (CTAS)

## Real-World Example: CRM Data Transformation

Typical transformation processing CRM data (e.g., HubSpot):

```sql
/* companies */
CREATE TABLE "out_companies" AS
SELECT
  "companyId",
  "name",
  "website",
  TRY_CAST(NULLIF("createdate", '') AS DATE) AS "createdate",
  "isDeleted"::BOOLEAN AS "isDeleted"
FROM "companies";

/* contacts */
CREATE TABLE "out_contacts" AS
SELECT
  "canonical_vid",
  "firstname",
  "lastname",
  "email",
  TRY_CAST(NULLIF("createdate", '') AS DATE) AS "createdate",
  "hs_analytics_source" AS "email_source",
  "associatedcompanyid",
  "lifecyclestage"
FROM "contacts";

/* deals */
CREATE TABLE "out_deals" AS
SELECT
  "dealId",
  "isDeleted"::BOOLEAN AS "isDeleted",
  "dealname",
  TRY_CAST(NULLIF("createdate", '') AS DATE) AS "createdate",
  TRY_CAST(NULLIF("closedate", '') AS DATE) AS "closedate",
  "dealtype",
  TRY_CAST(NULLIF("amount", '') AS DOUBLE) AS "amount",
  "pipeline",
  "dealstage",
  "hubspot_owner_id",
  "hs_analytics_source"
FROM "deals";

/* pipeline stages */
CREATE TABLE "out_stages" AS
SELECT
  "stageId",
  "label",
  TRY_CAST(NULLIF("displayOrder", '') AS INT) AS "displayOrder",
  TRY_CAST(NULLIF("probability", '') AS DOUBLE) AS "probability",
  "closedWon"::BOOLEAN AS "closedWon"
FROM "pipeline_stages";

/* deals-contacts association */
CREATE TABLE "out_deals_contacts" AS
SELECT
  "contact_vid",
  "dealId"
FROM "deals_contacts_list";

/* activities */
CREATE TABLE "out_activities" AS
SELECT
  "engagement_id",
  "metadata_subject",
  TRY_CAST(NULLIF("engagement_createdAt", '') AS DATE) AS "engagement_createdAt",
  "metadata_durationMilliseconds",
  "associations_contactIds",
  "associations_dealIds",
  "associations_ownerIds"
FROM "activities";
```

## Best Practices

1. **Start with Small backend**, scale up as needed
2. **Use Parquet** for datasets > 1 GB
3. **Terminate every statement with `;`** when multiple statements in a script
4. **Use consistent casing** for identifiers (prefer lowercase)
5. **Quote identifiers** with mixed case or special characters
6. **Filter and project early** --- apply WHERE close to source, select only needed columns
7. **Use EXPLAIN** to analyze execution plans for expensive queries
8. **Split complex transformations** into smaller steps, each producing one output table
9. **Use consistent naming** for output tables (e.g., `stg_`, `fact_`, `dim_` prefixes)
10. **Use sync actions** for debugging (syntax_check, lineage_visualization, execution_plan)
11. **Test migrations carefully** when moving from Snowflake
12. **Use `TRY_CAST(NULLIF(...) AS TYPE)`** pattern for safe type conversion of potentially empty values

## When to Use DuckDB vs. Snowflake

**Choose DuckDB for:**
- Ad-hoc analysis and small-to-medium datasets (up to a few TB)
- Rapid prototyping of transformations
- Projects with limited budgets
- Development and testing

**Choose Snowflake for:**
- Very large datasets (TB+)
- Complex enterprise workloads
- Sharing warehouses across multiple processes
- Maximum scalability
- Advanced Snowflake-specific features

**DuckDB is NOT for transactional workloads.** It is an OLAP database optimized for SELECT statements.
Avoid frequent INSERT/UPDATE operations.

## Reference Links

- [DuckDB Official](https://duckdb.org/)
- [SQLGlot](https://github.com/tobymao/sqlglot) --- SQL transpilation
- [DuckDB Snowflake Extension](https://duckdb.org/community_extensions/extensions/snowflake) --- for local development
- [Component README](https://github.com/keboola/component-duckdb-transformation/blob/main/README.md)
- [Migration Component README](https://github.com/keboola/component-transformation-migration/blob/main/README.md)
- [Keboola DuckDB Documentation](https://help.keboola.com/transformations/duckdb/)
