"""DuckDB cache harness for Python Keboola apps.

Customize: SNOWFLAKE_PULL_SQL, CREATE TABLE schemas, INSERT projection.

Usage:
    from cache import init, refresh, query, status

    init()
    refresh(run_snowflake)  # pass your workspace-query callable
    rows = query("SELECT name, value FROM items WHERE value > 100")
"""
from __future__ import annotations

import threading
import time
from typing import Callable, Iterable

import duckdb
import pandas as pd

_con = duckdb.connect(":memory:")
_lock = threading.Lock()
_last_refresh: float | None = None
_row_count = 0
_last_error: str | None = None
_refreshing = False

# EDIT THIS: pull SQL against your Keboola workspace.
# Snowflake quoting shown. On a BigQuery project use backticks and the mangled
# dataset name with no stage prefix (e.g. `in_c_bucket`.`table`) — see
# references/storage-access.md "BigQuery SQL dialect".
SNOWFLAKE_PULL_SQL = """
    SELECT "id" AS id, "name" AS name, "value" AS value
    FROM "in.c-bucket"."table"
"""


def init() -> None:
    """Create the cached tables. Idempotent."""
    # EDIT THIS: define the cached schema.
    _con.execute(
        """
        CREATE TABLE IF NOT EXISTS items (
            id VARCHAR,
            name VARCHAR,
            value DOUBLE
        )
        """
    )


def refresh(run_snowflake: Callable[[str], Iterable[dict]], *, force: bool = False) -> None:
    """Pull from Snowflake and replace the cache contents.

    `run_snowflake(sql)` must return an iterable of dicts.
    """
    global _last_refresh, _row_count, _last_error, _refreshing

    with _lock:
        if _refreshing and not force:
            return
        _refreshing = True

    try:
        t0 = time.time()
        rows = list(run_snowflake(SNOWFLAKE_PULL_SQL))
        df = pd.DataFrame(rows)

        _con.execute("BEGIN")
        _con.execute("DELETE FROM items")
        if not df.empty:
            _con.register("incoming", df)
            _con.execute(
                "INSERT INTO items SELECT id, name, TRY_CAST(value AS DOUBLE) FROM incoming"
            )
            _con.unregister("incoming")
        _con.execute("COMMIT")

        _row_count = int(_con.execute("SELECT COUNT(*) FROM items").fetchone()[0])
        _last_refresh = time.time()
        _last_error = None
        print(f"[duck] refreshed {_row_count} rows in {time.time() - t0:.1f}s")
    except Exception as e:
        _con.execute("ROLLBACK")
        _last_error = str(e)
        raise
    finally:
        with _lock:
            _refreshing = False


def query(sql: str) -> pd.DataFrame:
    """Run a SQL query against the cached DuckDB and return a DataFrame."""
    return _con.execute(sql).df()


def status() -> dict:
    return {
        "last_refresh": _last_refresh,
        "row_count": _row_count,
        "last_error": _last_error,
        "refreshing": _refreshing,
    }
