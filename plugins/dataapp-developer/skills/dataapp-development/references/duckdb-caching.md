# DuckDB Caching

**Use this when:** building a read-only dashboarding app that reads from Keboola Storage. This is the default storage-access pattern — caching avoids re-querying Snowflake on every page render and cuts data-warehouse costs significantly.

## Why

DWH cost containment is the primary motivation. Querying Snowflake on every render burns credits for data that changed once:

- A 5-KPI dashboard viewed by 100 users per day = 500 queries/day for data that may have changed once that morning. Across the customer's full dashboard fleet, that's the bulk of their warehouse bill.
- DWH credits are billed per query AND per byte scanned — repeated identical queries burn budget for no information gain.
- An in-memory DuckDB serves the same query sub-millisecond per call. The dashboard feels instant.
- The trade-off (data up to N minutes old) is invisible for almost every dashboard use case — aggregates, KPIs, and trend charts don't move minute-to-minute.

## When DuckDB caching IS the right default

Apply this pattern when all of:
- The app is read-only (no writes back to Storage).
- Data freshness in minutes (5–60) is acceptable for users.
- The cached dataset fits in container memory — rule of thumb, hundreds of MB max.

## When to skip DuckDB caching

Fall back to direct access when:
- The app writes back via Storage Access (RW). See [storage-access.md](storage-access.md) — every read must be current; no caching.
- The user expects sub-minute freshness (live operational dashboards, real-time monitoring).
- The dataset is too large to fit in memory. Use pagination + direct RO workspace queries instead, or pre-aggregate before caching.

## Node.js pattern

Module-level singleton — one DuckDB instance per server process.

```javascript
const duckdb = require('duckdb');
const fs = require('fs');
const path = require('path');

const db = new duckdb.Database(':memory:');
const conn = db.connect();

let lastRefresh = null;
let rowCount = 0;
let lastError = null;
let refreshPromise = null;

function init() {
  conn.run(`
    CREATE TABLE IF NOT EXISTS items (
      id VARCHAR,
      name VARCHAR,
      value DOUBLE
    )
  `);
}

async function refresh({ force = false } = {}) {
  if (refreshPromise && !force) return refreshPromise;
  refreshPromise = (async () => {
    const tmpFile = `/tmp/items-${Date.now()}.ndjson`;
    try {
      const rows = await pullFromSnowflake(); // your workspace query call
      fs.writeFileSync(tmpFile, rows.map((r) => JSON.stringify(r)).join('\n'));
      await runSql('BEGIN');
      await runSql('DELETE FROM items');
      await runSql(`
        INSERT INTO items
        SELECT id, name, TRY_CAST(value AS DOUBLE)
        FROM read_json_auto('${tmpFile}', ignore_errors=true)
      `);
      await runSql('COMMIT');
      rowCount = (await query('SELECT COUNT(*) AS c FROM items'))[0].c;
      lastRefresh = Date.now();
      lastError = null;
    } catch (err) {
      await runSql('ROLLBACK').catch(() => {});
      lastError = err.message;
      throw err;
    } finally {
      fs.existsSync(tmpFile) && fs.unlinkSync(tmpFile);
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function query(sql) {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(normalize));
    });
  });
}

function normalize(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'bigint') out[k] = Number(v);
    else if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

function status() {
  return { lastRefresh, rowCount, lastError, refreshing: refreshPromise !== null };
}

module.exports = { init, refresh, query, status };
```

Background auto-refresh:

```javascript
const AUTO_REFRESH_MS = Number(process.env.AUTO_REFRESH_MS) || 60 * 60 * 1000;

setInterval(() => {
  duck.refresh({ force: true }).catch((err) => console.error('auto-refresh failed:', err.message));
}, AUTO_REFRESH_MS);
```

Admin endpoint to force refresh:

```javascript
app.post('/api/refresh', (_req, res) => {
  duck.refresh({ force: true })
    .then(() => res.json({ ok: true, duck: duck.status() }))
    .catch((err) => res.status(500).json({ ok: false, error: err.message }));
});
```

Pointer: full reference template at `templates/duckdb-cache/nodejs/duck.js`.

## Python pattern

Analogous shape using the `duckdb` Python package. Module-level singleton.

```python
import duckdb, threading, time, pandas as pd

_con = duckdb.connect(":memory:")
_lock = threading.Lock()
_last_refresh = None
_row_count = 0
_last_error = None
_refreshing = False

SNOWFLAKE_PULL_SQL = '''
    SELECT "id" AS id, "name" AS name, "value" AS value
    FROM "in.c-bucket"."table"
'''

def init():
    _con.execute('''
        CREATE TABLE IF NOT EXISTS items (
            id VARCHAR,
            name VARCHAR,
            value DOUBLE
        )
    ''')

def refresh(run_snowflake, *, force=False):
    global _last_refresh, _row_count, _last_error, _refreshing
    with _lock:
        if _refreshing and not force:
            return
        _refreshing = True
    try:
        df = pd.DataFrame(list(run_snowflake(SNOWFLAKE_PULL_SQL)))
        _con.execute("BEGIN")
        _con.execute("DELETE FROM items")
        if not df.empty:
            _con.register("incoming", df)
            _con.execute("INSERT INTO items SELECT id, name, TRY_CAST(value AS DOUBLE) FROM incoming")
            _con.unregister("incoming")
        _con.execute("COMMIT")
        _row_count = int(_con.execute("SELECT COUNT(*) FROM items").fetchone()[0])
        _last_refresh = time.time()
        _last_error = None
    except Exception as e:
        _con.execute("ROLLBACK")
        _last_error = str(e)
        raise
    finally:
        with _lock:
            _refreshing = False

def query(sql):
    return _con.execute(sql).df()

def status():
    return {
        "last_refresh": _last_refresh,
        "row_count": _row_count,
        "last_error": _last_error,
        "refreshing": _refreshing,
    }
```

Notes:
- `_con.register("name", df)` is the fastest way to load a DataFrame into DuckDB. No tmp file needed.
- For very large pulls, write to a parquet file and `INSERT INTO ... FROM read_parquet(...)` instead.
- Background refresh: use `threading.Timer` or APScheduler. For Streamlit apps, start it in a top-level guard `if "refresh_thread" not in st.session_state: ...`.

Pointer: full reference template at `templates/duckdb-cache/python/cache.py`.

## Streamlit caching alternative

For Streamlit apps where the cache only needs to survive within a single user session (not shared across all users), `@st.cache_data(ttl=300)` is simpler:

```python
@st.cache_data(ttl=300)
def load_data():
    return execute_aggregation_query("SELECT ...")
```

Use `@st.cache_data` when:
- The user's interactive filters change frequently and you want responsive UI.
- The cache only needs to survive a few minutes.

Use DuckDB when:
- You need a single shared cache across ALL users/sessions.
- You want to run arbitrary SQL against cached data, not just lookup pre-computed results.
- You're on a non-Streamlit app type.

You can combine both: DuckDB for the shared cache + `@st.cache_data` for derived per-session aggregations.

## Template

Runnable starters live at:
- `templates/duckdb-cache/nodejs/duck.js`
- `templates/duckdb-cache/python/cache.py`

Both have `init()`, `refresh()`, `query()`, `status()` with the same shape. Copy into your app, edit `SNOWFLAKE_PULL_SQL` and the `CREATE TABLE` / `INSERT` projection for your data.
