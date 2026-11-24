"""DuckDB cache harness for Python Keboola apps.

Customize: SNOWFLAKE_PULL_SQL, CREATE TABLE schemas, INSERT projection.

Usage:
    from cache import init, refresh, query, status

    init()
    refresh(run_snowflake)  # pass your workspace-query callable
    if enabled():
        rows = query("SELECT name, value FROM items WHERE value > 100")
    else:
        ...  # a governed workspace: query the workspace per request, as the user

One shared table must never hold rows of a workspace governed by row-level security.
The cache turns itself off for the life of the process when the workspace manifest
(KBC_WORKSPACE_MANIFEST_PATH) says `"governed": true`, read on every call of init(),
refresh(), enabled() and query(), and also when Query Service refuses the refresh, which
runs without a user.
"""
from __future__ import annotations

import contextlib
import json
import os
import threading
import time
from typing import Callable, Iterable

import duckdb
import pandas as pd
from keboola_query_service import RowLevelSecurityError

_con = duckdb.connect(":memory:")
_lock = threading.Lock()
_refresh_lock = threading.Lock()
_last_refresh: float | None = None
_row_count = 0
_last_error: str | None = None
_refreshing = False
_governed = False

# EDIT THIS: pull SQL against your Keboola workspace.
# Snowflake quoting shown. On a BigQuery project use backticks and the mangled
# dataset name, e.g. `in_c_bucket`.`table` — the `in` stage stays inside the
# dataset name, not a separate segment. See references/storage-access.md
# "BigQuery SQL dialect".
SNOWFLAKE_PULL_SQL = """
    SELECT "id" AS id, "name" AS name, "value" AS value
    FROM "in.c-bucket"."table"
"""


def _manifest_says_governed() -> bool:
    path = os.environ.get("KBC_WORKSPACE_MANIFEST_PATH")
    if not path:
        return False
    try:
        with open(path, encoding="utf-8") as manifest_file:
            manifest = json.load(manifest_file)
    except (OSError, ValueError):
        return False
    return isinstance(manifest, dict) and manifest.get("governed") is True


def _check_manifest() -> None:
    if not _governed and _manifest_says_governed():
        _turn_off("the workspace manifest says the workspace is governed")


def _clear() -> None:
    # A refresh that writes at the same time can make this DELETE fail; that refresh clears the table after its
    # commit, and query() refuses to read it either way.
    with _con.cursor() as cur, contextlib.suppress(duckdb.Error):
        cur.execute("DELETE FROM items")


def _turn_off(reason: str) -> None:
    global _governed, _row_count, _last_error
    _governed = True
    _clear()
    _row_count = 0
    _last_error = reason
    print(f"[duck] {reason}; the cache is off")


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
    _check_manifest()


def refresh(run_snowflake: Callable[[str], Iterable[dict]], *, force: bool = False) -> None:
    """Pull from Snowflake and replace the cache contents.

    `run_snowflake(sql)` must return an iterable of dicts.
    """
    global _last_refresh, _row_count, _last_error, _refreshing

    _check_manifest()
    if _governed:
        return
    if not _refresh_lock.acquire(blocking=force):
        return
    with _lock:
        _refreshing = True

    try:
        t0 = time.time()
        try:
            rows = list(run_snowflake(SNOWFLAKE_PULL_SQL))
        except RowLevelSecurityError as e:
            _turn_off(f"row-level security refused the refresh: {e}")
            return
        except Exception as e:
            _last_error = str(e)
            raise
        # The workspace can turn governed while the pull runs.
        _check_manifest()
        if _governed:
            return
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
                _last_error = str(e)
                with contextlib.suppress(duckdb.Error):
                    cur.execute("ROLLBACK")
                raise

            _row_count = int(cur.execute("SELECT COUNT(*) FROM items").fetchall()[0][0])
        _check_manifest()
        if _governed:
            _clear()
            _row_count = 0
            return
        _last_refresh = time.time()
        _last_error = None
        print(f"[duck] refreshed {_row_count} rows in {time.time() - t0:.1f}s")
    finally:
        with _lock:
            _refreshing = False
        _refresh_lock.release()


def enabled() -> bool:
    """False once the workspace is known to be governed (manifest or a refused refresh)."""
    _check_manifest()
    return not _governed


def query(sql: str) -> pd.DataFrame:
    """Run a SQL query against the cached DuckDB and return a DataFrame."""
    _check_manifest()
    if _governed:
        raise RuntimeError("The cache is off: row-level security governs the workspace.")
    with _con.cursor() as cur:
        return cur.execute(sql).df()


def status() -> dict:
    return {
        "last_refresh": _last_refresh,
        "row_count": _row_count,
        "last_error": _last_error,
        "refreshing": _refreshing,
        "governed": _governed,
    }
