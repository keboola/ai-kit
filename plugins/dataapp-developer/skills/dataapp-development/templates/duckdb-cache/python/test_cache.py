import importlib
import sys
from pathlib import Path

import pytest
from keboola_query_service import RowLevelSecurityError

sys.path.insert(0, str(Path(__file__).resolve().parent))


@pytest.fixture
def cache():
    import cache as module

    module = importlib.reload(module)
    module.init()
    return module


def _rows(sql):
    return [{"id": "1", "name": "a", "value": "10"}]


def _refused(sql):
    raise RowLevelSecurityError("Row-level security does not allow this query", status_code=403)


def test_refresh_fills_the_cache(cache):
    cache.refresh(_rows)

    assert cache.enabled()
    assert cache.query("SELECT name FROM items")["name"].tolist() == ["a"]


def test_row_level_security_refusal_turns_the_cache_off(cache):
    cache.refresh(_refused)

    assert not cache.enabled()
    assert cache.status()["governed"] is True
    with pytest.raises(RuntimeError, match="row-level security"):
        cache.query("SELECT name FROM items")


def test_refusal_drops_rows_of_an_earlier_refresh(cache):
    cache.refresh(_rows)
    cache.refresh(_refused)

    assert cache.status()["row_count"] == 0
    assert cache._con.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 0


def test_no_refresh_after_the_cache_is_off(cache):
    cache.refresh(_refused)
    calls = []

    cache.refresh(lambda sql: calls.append(sql) or [])

    assert calls == []


def test_other_errors_keep_the_cache_on(cache):
    def failing(sql):
        raise RuntimeError("warehouse down")

    with pytest.raises(RuntimeError, match="warehouse down"):
        cache.refresh(failing)

    assert cache.enabled()
