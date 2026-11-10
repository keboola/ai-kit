import base64
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
import streamlit as st
from keboola_query_service import AppUserToken, RowLevelSecurityError, StorageToken

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils import data_loader  # noqa: E402


def _token(idp="https://idp.example.com", sub="user-1", nonce="1"):
    def part(data):
        return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")

    return f"{part({'alg': 'RS256'})}.{part({'idp': idp, 'sub': sub, 'jti': nonce})}.signature"


def _result(rows):
    return [SimpleNamespace(columns=[SimpleNamespace(name="A")], data=rows)]


@pytest.fixture
def query_service(monkeypatch):
    monkeypatch.setenv("QUERY_SERVICE_URL", "https://query.example.com")
    monkeypatch.setenv("KBC_TOKEN", "storage-token")
    monkeypatch.setenv("BRANCH_ID", "678")
    monkeypatch.setenv("WORKSPACE_ID", "12345")
    monkeypatch.delenv("KBC_WORKSPACE_MANIFEST_PATH", raising=False)
    st.cache_data.clear()
    st.cache_resource.clear()
    client = MagicMock(name="client")
    client.execute_query.return_value = _result([["1"]])
    context = SimpleNamespace(headers={})
    with (
        patch.object(data_loader, "Client", return_value=client),
        patch.object(data_loader.st, "context", context),
        patch.object(data_loader.st, "error") as error,
    ):
        yield SimpleNamespace(client=client, headers=context.headers, error=error)
    st.cache_data.clear()
    st.cache_resource.clear()


def _auth(query_service, call=-1):
    return query_service.client.execute_query.call_args_list[call].kwargs["auth"]


def test_query_sends_the_user_token_with_the_storage_token(query_service):
    query_service.headers["X-Kbc-App-User-Token"] = _token()

    df = data_loader.execute_aggregation_query("SELECT 1")

    assert df["A"].tolist() == ["1"]
    auth = _auth(query_service)
    assert isinstance(auth, AppUserToken)
    assert auth.credential_headers() == {
        "X-Kbc-App-User-Token": _token(),
        "X-StorageAPI-Token": "storage-token",
    }


def test_user_token_is_read_before_every_request(query_service):
    query_service.headers["X-Kbc-App-User-Token"] = _token(nonce="1")
    data_loader.execute_aggregation_query("SELECT 1")
    auth = _auth(query_service)

    query_service.headers["X-Kbc-App-User-Token"] = _token(nonce="2")

    assert auth.credential_headers()["X-Kbc-App-User-Token"] == _token(nonce="2")


def test_query_without_user_token_sends_only_the_storage_token(query_service):
    data_loader.execute_aggregation_query("SELECT 1")

    auth = _auth(query_service)
    assert isinstance(auth, StorageToken)
    assert auth.credential_headers() == {"X-StorageAPI-Token": "storage-token"}


def test_two_users_get_separate_cache_entries(query_service):
    query_service.client.execute_query.side_effect = [_result([["rows of user 1"]]), _result([["rows of user 2"]])]

    query_service.headers["X-Kbc-App-User-Token"] = _token(sub="user-1")
    first = data_loader.execute_aggregation_query("SELECT 1")
    query_service.headers["X-Kbc-App-User-Token"] = _token(sub="user-2")
    second = data_loader.execute_aggregation_query("SELECT 1")

    assert first["A"].tolist() == ["rows of user 1"]
    assert second["A"].tolist() == ["rows of user 2"]
    assert query_service.client.execute_query.call_count == 2


def test_same_user_with_a_new_token_hits_the_cache(query_service):
    query_service.headers["X-Kbc-App-User-Token"] = _token(nonce="1")
    data_loader.execute_aggregation_query("SELECT 1")
    query_service.headers["X-Kbc-App-User-Token"] = _token(nonce="2")
    data_loader.execute_aggregation_query("SELECT 1")

    assert query_service.client.execute_query.call_count == 1


def test_same_sub_of_another_identity_provider_is_another_user(query_service):
    query_service.headers["X-Kbc-App-User-Token"] = _token(idp="https://a.example.com")
    data_loader.execute_aggregation_query("SELECT 1")
    query_service.headers["X-Kbc-App-User-Token"] = _token(idp="https://b.example.com")
    data_loader.execute_aggregation_query("SELECT 1")

    assert query_service.client.execute_query.call_count == 2


def test_requests_without_user_token_share_the_no_user_entry(query_service):
    data_loader.execute_aggregation_query("SELECT 1")
    data_loader.execute_aggregation_query("SELECT 1")

    assert query_service.client.execute_query.call_count == 1


@pytest.mark.parametrize("token", ["not-a-jwt", "a.bm90IGpzb24.c", _token(sub="")])
def test_unreadable_user_token_is_not_cached(query_service, token):
    query_service.headers["X-Kbc-App-User-Token"] = token

    data_loader.execute_aggregation_query("SELECT 1")
    data_loader.execute_aggregation_query("SELECT 1")

    assert query_service.client.execute_query.call_count == 2


def test_row_level_security_refusal_tells_the_user(query_service):
    query_service.headers["X-Kbc-App-User-Token"] = _token()
    query_service.client.execute_query.side_effect = RowLevelSecurityError(
        "Row-level security does not allow this query", status_code=403
    )

    df = data_loader.execute_aggregation_query("SELECT 1")

    assert df.empty
    query_service.error.assert_called_once_with("You have no access to this data.")


def test_failure_is_not_cached(query_service):
    query_service.headers["X-Kbc-App-User-Token"] = _token()
    query_service.client.execute_query.side_effect = [RuntimeError("token expired"), _result([["1"]])]

    failed = data_loader.execute_aggregation_query("SELECT 1")
    retried = data_loader.execute_aggregation_query("SELECT 1")

    assert failed.empty
    assert "token expired" in query_service.error.call_args.args[0]
    assert retried["A"].tolist() == ["1"]


def test_client_is_shared_by_all_users(query_service):
    query_service.headers["X-Kbc-App-User-Token"] = _token(sub="user-1")
    data_loader.execute_aggregation_query("SELECT 1")
    query_service.headers["X-Kbc-App-User-Token"] = _token(sub="user-2")
    data_loader.execute_aggregation_query("SELECT 1")

    assert data_loader.Client.call_count == 1


def test_missing_branch_id_is_shown(query_service, monkeypatch):
    monkeypatch.delenv("BRANCH_ID")

    df = data_loader.execute_aggregation_query("SELECT 1")

    assert df.empty
    assert "BRANCH_ID" in query_service.error.call_args.args[0]
    assert isinstance(df, pd.DataFrame)
