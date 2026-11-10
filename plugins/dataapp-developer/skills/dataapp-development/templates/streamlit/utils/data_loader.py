"""Centralized data access for the Streamlit app.

Uses the Keboola Query Service via the official `keboola-query-service`
Python SDK. The SDK handles submit + poll + paginate against
`https://query.<stack>.keboola.com/api/v1/...` — don't roll a raw call
to `/v2/storage/.../workspaces/.../query` (that's the legacy Storage API
workspace-query endpoint; it 404s on most Snowflake projects).
"""
import base64
import json
import os
import urllib.request
from urllib.parse import urljoin

import pandas as pd
import streamlit as st
from keboola_query_service import AppUserToken, Client, RowLevelSecurityError, StorageToken

NO_USER = ("no user",)


def _get(name: str, default: str | None = None) -> str | None:
    """Read config from env (Keboola production) or st.secrets (local dev)."""
    value = os.environ.get(name)
    if value:
        return value
    try:
        return st.secrets.get(name, default)
    except FileNotFoundError:
        return default


def _query_service_url_from_index(kbc_url: str | None) -> str | None:
    """The stack's Query Service URL from the Storage API index (local runs; Keboola injects QUERY_SERVICE_URL)."""
    if not kbc_url:
        return None
    index_url = urljoin(kbc_url, "/v2/storage/?exclude=components")
    with urllib.request.urlopen(index_url, timeout=10) as response:
        services = json.load(response)["services"]
    return next((service["url"] for service in services if service["id"] == "query"), None)


def _resolve_workspace_id() -> str | None:
    """Read workspace ID from the manifest file (preferred) or the env var fallback."""
    manifest_path = _get("KBC_WORKSPACE_MANIFEST_PATH")
    if manifest_path and os.path.exists(manifest_path):
        with open(manifest_path) as f:
            return json.load(f).get("workspaceId")
    return _get("WORKSPACE_ID")


def app_user_token() -> str | None:
    """The signed-in user's token, which Keboola's apps proxy adds after an OAuth/OIDC login.

    The only place that reads it: every query gets it through this function.
    """
    return st.context.headers.get("X-Kbc-App-User-Token") or None


def _user_key() -> tuple[str, ...] | None:
    """The cache key of the signed-in user: the token's `idp` and `sub`, the same for every token of that user.

    The token is not verified: only the apps proxy sets the header, and it drops copies sent by the browser.
    None for a token that cannot be read: such a query is not cached.
    """
    token = app_user_token()
    if token is None:
        return NO_USER
    try:
        payload = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        idp, sub = claims["idp"], claims["sub"]
    except (IndexError, ValueError, KeyError, TypeError):
        return None
    if not (isinstance(idp, str) and isinstance(sub, str) and idp and sub):
        return None
    return (idp, sub)


@st.cache_resource
def _storage_token() -> StorageToken:
    kbc_token = _get("KBC_TOKEN")
    if not kbc_token:
        raise RuntimeError("Missing KBC_TOKEN. Ask the user to populate .streamlit/secrets.toml or .env.")
    return StorageToken(kbc_token)


@st.cache_resource
def _client() -> Client:
    """One Query Service client for the whole process, shared by every session and user.

    `@st.cache_resource` keeps the same Client across reruns so the HTTP
    pool isn't re-created on every interaction. The user's credential goes
    with each call (`auth=`), never into this client.
    """
    query_service_url = _get("QUERY_SERVICE_URL") or _query_service_url_from_index(_get("KBC_URL"))
    if not query_service_url:
        raise RuntimeError(
            "Missing QUERY_SERVICE_URL (or KBC_URL to look it up). "
            "Ask the user to populate .streamlit/secrets.toml or .env."
        )
    return Client(base_url=query_service_url, auth=_storage_token())


def _auth() -> AppUserToken | StorageToken:
    """The user's token with the app's Storage token, or only the Storage token when no user is signed in."""
    if app_user_token() is None:
        return _storage_token()
    # A callable: the SDK reads the current token before every request of the query.
    return AppUserToken(app_user_token, storage_token=_storage_token())


def execute_aggregation_query(sql: str) -> pd.DataFrame:
    """Execute SQL via the Keboola Query Service and return a DataFrame.

    Results are cached for 5 minutes per user. Failed queries are not cached.

    Returns:
      DataFrame with one column per result column. All cell values come
      back as strings (Query Service behavior); convert numeric / date
      columns at the call site:
          df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
          df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    """
    user_key = _user_key()
    try:
        if user_key is None:
            return _run_query(sql)
        return _cached_query(sql, user_key)
    except RowLevelSecurityError:
        st.error("You have no access to this data.")
    except Exception as exc:
        st.error(f"Query Service call failed: {exc}")
    return pd.DataFrame()


# `user_key` is part of the cache key, so each user gets their own entry. It must not start with `_`:
# st.cache_data leaves such arguments out of the key, and one user's rows would go to the next user.
@st.cache_data(ttl=300)
def _cached_query(sql: str, user_key: tuple[str, ...]) -> pd.DataFrame:
    return _run_query(sql)


def _run_query(sql: str) -> pd.DataFrame:
    branch_id = _get("BRANCH_ID")
    workspace_id = _resolve_workspace_id()

    if not branch_id:
        raise RuntimeError(
            "Missing BRANCH_ID. The Query Service requires a numeric branch ID — "
            "the string 'default' is rejected. Get it from "
            "mcp__keboola__get_project_info (`branch_id` field) and paste into "
            ".streamlit/secrets.toml."
        )
    if not workspace_id:
        raise RuntimeError(
            "Missing workspace ID. Set KBC_WORKSPACE_MANIFEST_PATH (Storage Access "
            "production) or WORKSPACE_ID (local dev)."
        )

    results = _client().execute_query(
        branch_id=str(branch_id),
        workspace_id=str(workspace_id),
        statements=[sql],
        auth=_auth(),
    )
    result = results[0]
    cols = [c.name for c in result.columns]
    return pd.DataFrame(result.data, columns=cols)
