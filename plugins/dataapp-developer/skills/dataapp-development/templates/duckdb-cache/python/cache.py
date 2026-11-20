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
_refresh_lock = threading.Lock()
_last_refresh: float | None = None
_row_count = 0
_last_error: str | None = None
_refreshing = False

# EDIT THIS: pull SQL against your Keboola workspace.
# Snowflake quoting shown. On a BigQuery project use backticks and the mangled
# dataset name, e.g. `in_c_bucket`.`table` — the `in` stage stays inside the
# dataset name, not a separate segment. See references/storage-access.md
# "BigQuery SQL dialect".
SNOWFLAKE_PULL_SQL = """
    SELECT "id" AS id, "name" AS name, "value" AS value
    FROM "in.c-bucket"."table"
"""


def init() -> None:
    """Create the cached tables. Idempotent."""
    # EDIT THIS: define the cached schema.
    with _con.cursor() as cur:
        cur.execute(
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

    if not _refresh_lock.acquire(blocking=force):
        return
    with _lock:
        _refreshing = True

    try:
        t0 = time.time()
        try:
            rows = list(run_snowflake(SNOWFLAKE_PULL_SQL))
        except Exception as e:
            _last_error = str(e)
            raise
        df = pd.DataFrame(rows)

        with _con.cursor() as cur:
            try:
                cur.execute("BEGIN")
                cur.execute("DELETE FROM items")
                if not df.empty:
                    cur.register("incoming", df)
                    cur.execute(
                        "INSERT INTO items SELECT id, name, TRY_CAST(value AS DOUBLE) FROM incoming"
                    )
                    cur.unregister("incoming")
                cur.execute("COMMIT")
            except Exception as e:
                cur.execute("ROLLBACK")
                _last_error = str(e)
                raise

            _row_count = int(cur.execute("SELECT COUNT(*) FROM items").fetchall()[0][0])
        _last_refresh = time.time()
        _last_error = None
        print(f"[duck] refreshed {_row_count} rows in {time.time() - t0:.1f}s")
    finally:
        with _lock:
            _refreshing = False
        _refresh_lock.release()


def query(sql: str) -> pd.DataFrame:
    """Run a SQL query against the cached DuckDB and return a DataFrame."""
    with _con.cursor() as cur:
        return cur.execute(sql).df()


def status() -> dict:
    return {
        "last_refresh": _last_refresh,
        "row_count": _row_count,
        "last_error": _last_error,
        "refreshing": _refreshing,
    }
