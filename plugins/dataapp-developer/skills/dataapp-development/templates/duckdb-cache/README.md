# DuckDB Cache Template

Generic harness for caching Keboola Snowflake data in an in-memory DuckDB so the app doesn't hit Snowflake on every page render.

## When to use this

- Read-only apps where data refresh interval is minutes, not seconds.
- Skip for RW apps (Storage Access via Query Service) — every read should be current.

## Files

- `nodejs/duck.js` — Node.js harness (init / refresh / query / status). Adapted from `kai-pricing-calculator-app/api/duck.js`.
- `python/cache.py` — Python harness, same API shape.

## Integration

Copy the relevant file into your app's `api/` (Node) or alongside your data-loader module (Python). Edit `SNOWFLAKE_PULL_SQL`, the `CREATE TABLE`, and the `INSERT` projection to match your data. Wire `refresh()` into a background interval (`setInterval` / `threading.Timer`) and an admin endpoint (`POST /api/refresh`).

See `references/duckdb-caching.md` in the dataapp-development skill for the full pattern.
