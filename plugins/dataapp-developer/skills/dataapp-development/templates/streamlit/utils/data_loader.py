"""Centralized data access for the Streamlit app.

Uses the Keboola Query Service via the official `keboola-query-service`
Python SDK. The SDK handles submit + poll + paginate against
`https://query.<stack>.keboola.com/api/v1/...` — don't roll a raw call
to `/v2/storage/.../workspaces/.../query` (that's the legacy Storage API
workspace-query endpoint; it 404s on most Snowflake projects).
"""
import json
import os

import pandas as pd
import streamlit as st
from keboola_query_service import Client


def _get(name: str, default: str | None = None) -> str | None:
    """Read config from env (Keboola production) or st.secrets (local dev)."""
    value = os.environ.get(name)
    if value:
        return value
    try:
        return st.secrets.get(name, default)
    except FileNotFoundError:
        return default


def _derive_query_service_url(kbc_url: str | None) -> str | None:
    """Derive QUERY_SERVICE_URL from KBC_URL by swapping `connection.` → `query.`."""
    if not kbc_url:
        return None
    return kbc_url.rstrip("/").replace("://connection.", "://query.", 1)


def _resolve_workspace_id() -> str | None:
    """Read workspace ID from the manifest file (preferred) or the env var fallback."""
    manifest_path = _get("KBC_WORKSPACE_MANIFEST_PATH")
    if manifest_path and os.path.exists(manifest_path):
        with open(manifest_path) as f:
            return json.load(f).get("workspaceId")
    return _get("KBC_WORKSPACE_ID") or _get("WORKSPACE_ID")


@st.cache_resource
def _client() -> Client:
    """Single Query Service client per Streamlit session.

    `@st.cache_resource` keeps the same Client across reruns so the HTTP
    pool isn't re-created on every interaction.
    """
    kbc_url = _get("KBC_URL")
    kbc_token = _get("KBC_TOKEN")
    query_service_url = _get("QUERY_SERVICE_URL") or _derive_query_service_url(kbc_url)
    if not (query_service_url and kbc_token):
        raise RuntimeError(
            "Missing QUERY_SERVICE_URL (or KBC_URL to derive it) and KBC_TOKEN. "
            "Ask the user to populate .streamlit/secrets.toml or .env."
        )
    return Client(base_url=query_service_url, token=kbc_token)


@st.cache_data(ttl=300)
def execute_aggregation_query(sql: str) -> pd.DataFrame:
    """Execute SQL via the Keboola Query Service and return a DataFrame.

    Returns:
      DataFrame with one column per result column. All cell values come
      back as strings (Query Service behavior); convert numeric / date
      columns at the call site:
          df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
          df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    """
    branch_id = _get("BRANCH_ID")
    workspace_id = _resolve_workspace_id()

    if not branch_id:
        st.error(
            "Missing BRANCH_ID. The Query Service requires a numeric branch ID — "
            "the string 'default' is rejected. Get it from "
            "mcp__keboola__get_project_info (`branch_id` field) and paste into "
            ".streamlit/secrets.toml."
        )
        return pd.DataFrame()
    if not workspace_id:
        st.error(
            "Missing workspace ID. Set KBC_WORKSPACE_MANIFEST_PATH (Storage Access "
            "production) or KBC_WORKSPACE_ID / WORKSPACE_ID (local dev)."
        )
        return pd.DataFrame()

    try:
        results = _client().execute_query(
            branch_id=str(branch_id),
            workspace_id=str(workspace_id),
            statements=[sql],
        )
    except Exception as exc:
        st.error(f"Query Service call failed: {exc}")
        return pd.DataFrame()

    result = results[0]
    cols = [c.name for c in result.columns]
    return pd.DataFrame(result.data, columns=cols)
