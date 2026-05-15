"""Centralized data access for the Streamlit app."""
import os
import pandas as pd
import requests
import streamlit as st


def _get(name: str, default: str | None = None) -> str | None:
    """Read config from env (Keboola production) or st.secrets (local dev)."""
    value = os.environ.get(name)
    if value:
        return value
    try:
        return st.secrets.get(name, default)
    except FileNotFoundError:
        return default


@st.cache_data(ttl=300)
def execute_aggregation_query(sql: str) -> pd.DataFrame:
    """Execute SQL against the Keboola workspace and return a DataFrame."""
    kbc_url = _get("KBC_URL")
    kbc_token = _get("KBC_TOKEN")
    workspace_id = _get("KBC_WORKSPACE_ID") or _get("WORKSPACE_ID")
    branch = _get("BRANCH_ID", "default")

    if not (kbc_url and kbc_token and workspace_id):
        st.error("Missing KBC_URL / KBC_TOKEN / KBC_WORKSPACE_ID.")
        return pd.DataFrame()

    endpoint = f"{kbc_url}/v2/storage/branch/{branch}/workspaces/{workspace_id}/query"
    headers = {"X-StorageApi-Token": kbc_token, "Content-Type": "application/json"}
    response = requests.post(endpoint, headers=headers, json={"query": sql}, timeout=30)

    if response.status_code != 200:
        st.error(f"Query failed: {response.status_code} {response.text[:300]}")
        return pd.DataFrame()

    rows = response.json().get("data", {}).get("rows", [])
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df.columns = [c.lower() for c in df.columns]
    return df
