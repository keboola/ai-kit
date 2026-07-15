"""Unit tests for db_name() and fqn() helpers.

The helpers themselves live in the SKILL.md markdown so the LLM can embed them
into Python heredocs at runtime. This file MIRRORS those definitions so they can
be tested. If you update one, update the other — `test_skill_consistency.py`
asserts they stay in sync.
"""
import email.message
import io
import json
import os
import sys
import urllib.error
from unittest.mock import patch, MagicMock

import pytest

CACHE_PATH = "/tmp/sl_db_name.txt"


# ---- Mirror of SKILL.md helpers ----
# Keep these definitions byte-identical with the SKILL.md API Primitives block.
# `test_skill_consistency.py::test_db_name_mirrors_skill` enforces this.

def db_name(stack, token):
    """Resolve Snowflake DB for the current project: KEBOOLA_<projectId>."""
    import urllib.request
    cache = CACHE_PATH
    if os.path.exists(cache):
        return open(cache).read().strip()
    try:
        req = urllib.request.Request(f"{stack}/v2/storage/tokens/verify",
                                      headers={'X-StorageApi-Token': token})
        pid = json.loads(urllib.request.urlopen(req, timeout=15).read())['owner']['id']
        name = f'KEBOOLA_{pid}'
    except Exception as e:
        print(f"⚠ db_name resolve failed ({e}); falling back to KEBOOLA", file=sys.stderr)
        name = 'KEBOOLA'
    open(cache, 'w').write(name)
    return name


def fqn(tid, db):
    t = tid.split('.')
    return f'"{db}"."{".".join(t[:-1])}"."{t[-1]}"'


# ---- fqn tests ----

def test_fqn_three_parts():
    assert fqn("out.c-gold.FACT_REVENUE", "KEBOOLA_293") == \
        '"KEBOOLA_293"."out.c-gold"."FACT_REVENUE"'


def test_fqn_preserves_dotted_schema():
    """Splitting on the LAST dot only — schema may contain dots (e.g. 'in.c-bucket')."""
    assert fqn("in.c-source.dotted.TABLE_X", "KEBOOLA_42") == \
        '"KEBOOLA_42"."in.c-source.dotted"."TABLE_X"'


def test_fqn_uses_dynamic_db():
    """Regression: M6 — fqn must accept db as a parameter, not hardcode KEBOOLA."""
    assert '"KEBOOLA_293"' in fqn("a.b.C", "KEBOOLA_293")
    assert '"KEBOOLA"'    not in fqn("a.b.C", "KEBOOLA_293")


# ---- db_name tests ----

@pytest.fixture(autouse=True)
def clear_cache():
    """Remove cache file before each test to ensure independence."""
    if os.path.exists(CACHE_PATH):
        os.remove(CACHE_PATH)
    yield
    if os.path.exists(CACHE_PATH):
        os.remove(CACHE_PATH)


def test_db_name_success_builds_keboola_projectid():
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps({"owner": {"id": 293}}).encode()
    mock_response.__enter__ = lambda _self: mock_response
    mock_response.__exit__  = lambda *_args: None
    with patch("urllib.request.urlopen", return_value=mock_response):
        assert db_name("https://connection.example.gcp.keboola.com", "tok") == "KEBOOLA_293"
    assert open(CACHE_PATH).read().strip() == "KEBOOLA_293"


def test_db_name_cache_hit_skips_http():
    open(CACHE_PATH, "w").write("KEBOOLA_999")
    with patch("urllib.request.urlopen") as urlopen:
        result = db_name("https://connection.example.gcp.keboola.com", "tok")
    assert result == "KEBOOLA_999"
    urlopen.assert_not_called()


def test_db_name_fallback_on_http_error(capsys):
    err = urllib.error.HTTPError("http://x", 401, "Unauthorized", email.message.Message(), io.BytesIO(b""))
    with patch("urllib.request.urlopen", side_effect=err):
        result = db_name("https://connection.example.gcp.keboola.com", "bad-token")
    assert result == "KEBOOLA"
    assert open(CACHE_PATH).read().strip() == "KEBOOLA"
    captured = capsys.readouterr()
    assert "db_name resolve failed" in captured.err
    assert "falling back to KEBOOLA" in captured.err


def test_db_name_fallback_on_malformed_response(capsys):
    bad_response = MagicMock()
    bad_response.read.return_value = b"not json"
    bad_response.__enter__ = lambda _self: bad_response
    bad_response.__exit__  = lambda *_args: None
    with patch("urllib.request.urlopen", return_value=bad_response):
        result = db_name("https://connection.example.gcp.keboola.com", "tok")
    assert result == "KEBOOLA"
    captured = capsys.readouterr()
    assert "db_name resolve failed" in captured.err
