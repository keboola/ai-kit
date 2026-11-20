import importlib
import sys
import threading
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

TIMEOUT = 5


@pytest.fixture
def cache():
    import cache as module

    module = importlib.reload(module)
    module.init()
    return module


def _rows(sql):
    return [{"id": "1", "name": "a", "value": "10"}]


def _named(*names):
    return lambda sql: [{"id": str(i), "name": name, "value": "1"} for i, name in enumerate(names)]


def _names(cache):
    return sorted(cache.query("SELECT name FROM items")["name"].tolist())


def _thread(target):
    errors = []

    def run():
        try:
            target()
        except Exception as e:
            errors.append(e)

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return thread, errors


class _PauseBefore:
    def __init__(self, statement, target, paused, resume):
        self._statement = statement
        self._target = target
        self._paused = paused
        self._resume = resume

    def execute(self, sql, *args, **kwargs):
        if sql.lstrip().upper().startswith(self._statement):
            self._paused.set()
            assert self._resume.wait(TIMEOUT)
        return self._target.execute(sql, *args, **kwargs)

    def cursor(self):
        return _PauseBefore(self._statement, self._target.cursor(), self._paused, self._resume)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self._target.close()

    def __getattr__(self, name):
        return getattr(self._target, name)


def test_refresh_fills_the_cache(cache):
    cache.refresh(_rows)

    assert cache.query("SELECT name FROM items")["name"].tolist() == ["a"]


def test_a_reader_during_a_refresh_sees_the_old_rows(cache):
    cache.refresh(_named("old-1", "old-2"))
    paused, resume = threading.Event(), threading.Event()
    cache._con = _PauseBefore("INSERT", cache._con, paused, resume)

    refresh, errors = _thread(lambda: cache.refresh(_named("new-1", "new-2", "new-3")))
    assert paused.wait(TIMEOUT)
    try:
        during = _names(cache)
    finally:
        resume.set()
        refresh.join(TIMEOUT)

    assert during == ["old-1", "old-2"]
    assert errors == []
    assert _names(cache) == ["new-1", "new-2", "new-3"]


def test_a_refresh_while_a_reader_runs_inside_duckdb(cache):
    cache.refresh(_named("old-1", "old-2"))
    entered, release = threading.Event(), threading.Event()

    def slow(name):
        entered.set()
        release.wait(TIMEOUT)
        return name

    cache._con.create_function("slow", slow, ["VARCHAR"], "VARCHAR", side_effects=True)
    result = []
    reader, reader_errors = _thread(
        lambda: result.append(sorted(cache.query("SELECT slow(name) AS name FROM items")["name"].tolist()))
    )
    assert entered.wait(TIMEOUT)
    try:
        cache.refresh(_named("new-1", "new-2", "new-3"))
    finally:
        release.set()
        reader.join(TIMEOUT)

    assert reader_errors == []
    assert result == [["old-1", "old-2"]]
    assert _names(cache) == ["new-1", "new-2", "new-3"]


def test_init_while_another_thread_uses_the_connection(cache):
    entered, release = threading.Event(), threading.Event()

    def slow(name):
        entered.set()
        release.wait(TIMEOUT)
        return name

    cache._con.create_function("slow", slow, ["VARCHAR"], "VARCHAR", side_effects=True)
    other, other_errors = _thread(lambda: cache._con.execute("SELECT slow('x')").fetchall())
    assert entered.wait(TIMEOUT)
    try:
        cache.init()
    finally:
        release.set()
        other.join(TIMEOUT)

    assert other_errors == []


def test_refreshing_stays_on_until_a_forced_refresh_ends(cache):
    first_entered, first_release = threading.Event(), threading.Event()
    second_entered, second_release = threading.Event(), threading.Event()

    def first(sql):
        first_entered.set()
        assert first_release.wait(TIMEOUT)
        return _named("first")(sql)

    def second(sql):
        second_entered.set()
        assert second_release.wait(TIMEOUT)
        return _named("second")(sql)

    one, one_errors = _thread(lambda: cache.refresh(first))
    assert first_entered.wait(TIMEOUT)
    two, two_errors = _thread(lambda: cache.refresh(second, force=True))
    first_release.set()
    one.join(TIMEOUT)
    assert second_entered.wait(TIMEOUT)

    try:
        assert cache.status()["refreshing"] is True
    finally:
        second_release.set()
        two.join(TIMEOUT)

    assert one_errors == two_errors == []
    assert cache.status()["refreshing"] is False
    assert _names(cache) == ["second"]


def test_a_failing_refresh_raises_its_error_and_ends(cache):
    cache.refresh(_rows)

    def failing(sql):
        raise RuntimeError("warehouse down")

    with pytest.raises(RuntimeError, match="warehouse down"):
        cache.refresh(failing)

    assert cache.status()["refreshing"] is False
    assert cache.status()["last_error"] == "warehouse down"
    assert _names(cache) == ["a"]


def test_a_failing_commit_reports_its_error(cache):
    cache._con.execute("DROP TABLE items")
    cache._con.execute("CREATE TABLE items (id VARCHAR PRIMARY KEY, name VARCHAR, value DOUBLE)")
    paused, resume = threading.Event(), threading.Event()
    con = cache._con
    cache._con = _PauseBefore("COMMIT", con, paused, resume)

    refresh, errors = _thread(lambda: cache.refresh(_named("new")))
    assert paused.wait(TIMEOUT)
    try:
        with con.cursor() as other:
            other.execute("INSERT INTO items VALUES ('0', 'other', 1)")
    finally:
        resume.set()
        refresh.join(TIMEOUT)

    assert [str(e) for e in errors] == [cache.status()["last_error"]]
    assert "duplicate key" in cache.status()["last_error"]
    assert cache.status()["refreshing"] is False
