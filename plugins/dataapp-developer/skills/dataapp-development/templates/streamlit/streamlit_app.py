"""Streamlit data app — minimal template for Keboola deployment."""
import streamlit as st
import plotly.express as px
from utils.data_loader import execute_aggregation_query

# Fully qualified table name. Copy from mcp__keboola__get_table's
# `fully_qualified_name` field — the database prefix is required so
# Data Catalog (cross-project linked) tables also resolve.
TABLE_FQN = '"KBC_REGION_PROJID"."out.c-bucket"."table_name"'

st.set_page_config(page_title="Keboola App", layout="wide")
st.title("Keboola Data App")

with st.sidebar:
    st.header("Filters")
    if "category" not in st.session_state:
        st.session_state.category = "All"
    category = st.radio(
        "Category:",
        options=["All", "Option A", "Option B"],
        index=["All", "Option A", "Option B"].index(st.session_state.category),
    )
    if category != st.session_state.category:
        st.session_state.category = category
        st.rerun()

where_parts = []
if st.session_state.category != "All":
    where_parts.append(f"\"category\" = '{st.session_state.category}'")
where_clause = " AND ".join(where_parts) if where_parts else "1=1"

query = f"""
    SELECT "category", COUNT(*) AS count
    FROM {TABLE_FQN}
    WHERE {where_clause}
    GROUP BY "category"
    ORDER BY count DESC
"""

df = execute_aggregation_query(query)

if df.empty:
    st.warning("No data available.")
else:
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total Rows", f"{int(df['count'].sum()):,}")
    with col2:
        st.metric("Categories", f"{len(df)}")

    fig = px.bar(df, x="category", y="count", title="Distribution by Category")
    st.plotly_chart(fig, use_container_width=True)
