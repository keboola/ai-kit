# Streamlit Patterns

SQL-first architecture and CX adaptation for Streamlit data apps on Keboola.

---

## Project Structure

```
streamlit_app.py              # Entry point: navigation, global filters, CSS injection
utils/
├── data_loader.py            # All SQL queries, Keboola workspace API
└── design.py                 # CSS injection, theming, custom HTML components
page_modules/
├── overview.py               # KPI metrics + charts
├── detail.py                 # Data tables with drill-down
├── trends.py                 # Time-series charts
└── assistant.py              # Kai chat tab (optional)
.streamlit/
└── config.toml               # Theme colors
pyproject.toml                # Dependencies
.gitignore
```

## Dependencies

```toml
# pyproject.toml
[project]
dependencies = [
    "streamlit>=1.38.0",
    "plotly>=5.0.0",
    "requests>=2.31.0",
    "pandas>=2.0.0",
]

# Optional: for Kai integration
# "kai-client>=0.11.0",
# "python-dotenv>=1.0.0",
```

## SQL-First Architecture

**Always push computation to the database, never load large datasets into Python.**

### Data Access Layer

```python
# utils/data_loader.py
import streamlit as st
import pandas as pd
import requests
import os

def _get_credentials():
    kbc_url = os.environ.get("KBC_URL") or st.secrets.get("KBC_URL")
    kbc_token = os.environ.get("KBC_TOKEN") or st.secrets.get("KBC_TOKEN")
    workspace_id = os.environ.get("KBC_WORKSPACE_ID") or st.secrets.get("KBC_WORKSPACE_ID")
    return kbc_url, kbc_token, workspace_id

@st.cache_data(ttl=300)
def execute_query(sql: str) -> pd.DataFrame:
    kbc_url, kbc_token, workspace_id = _get_credentials()
    endpoint = f"{kbc_url}/v2/storage/workspaces/{workspace_id}/query"
    headers = {"X-StorageApi-Token": kbc_token, "Content-Type": "application/json"}
    response = requests.post(endpoint, headers=headers, json={"query": sql})

    if response.status_code != 200:
        st.error(f"Query failed: {response.text}")
        return pd.DataFrame()

    result = response.json()
    rows = result.get("data", {}).get("rows", [])
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df.columns = df.columns.str.lower()
    return df

def get_table_name(table_id: str) -> str:
    last_dot = table_id.rfind(".")
    if last_dot > 0:
        bucket = table_id[:last_dot]
        table = table_id[last_dot + 1:].replace("-", "_")
        return f'"{bucket}"."{table}"'
    return f'"{table_id}"'
```

### Good vs Bad Patterns

```python
# GOOD: Aggregate in database
query = f'''
    SELECT "category", COUNT(*) as count, AVG("value") as avg_val
    FROM {get_table_name("out.c-data.events")}
    WHERE "date" >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY "category"
'''
df = execute_query(query)

# BAD: Load everything into Python
df = execute_query(f"SELECT * FROM {get_table_name('out.c-data.events')}")
result = df.groupby("category").agg({"value": "mean"})
```

## Global Filter Pattern

```python
# utils/data_loader.py
def get_filter_clause(filter_name: str, session_key: str, column: str, values_map: dict) -> str:
    if session_key not in st.session_state:
        st.session_state[session_key] = list(values_map.keys())[0]

    selected = st.session_state[session_key]
    if selected in values_map and values_map[selected]:
        return f'"{column}" = \'{values_map[selected]}\''
    return ''  # "All" option

# streamlit_app.py — sidebar
option = st.sidebar.radio("User Type:", ["External", "Internal", "All"], key="user_filter")

# page_modules/overview.py — use in queries
where_parts = ['"status" = \'active\'']
user_filter = get_filter_clause("user_type", "user_filter", "user_type", {
    "External": "External User",
    "Internal": "Keboola User",
    "All": None,
})
if user_filter:
    where_parts.append(user_filter)
where_clause = ' AND '.join(where_parts)
```

## CSS Injection for Theming

```python
# utils/design.py
import streamlit as st

def inject_theme(primary="#097cf7", secondary="#002151", accent="#CA8A04"):
    st.markdown(f"""<style>
    /* Brand colors as CSS variables */
    :root {{
        --brand-primary: {primary};
        --brand-secondary: {secondary};
        --brand-accent: {accent};
    }}

    /* Enhanced metric cards */
    [data-testid="stMetric"] {{
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        transition: box-shadow 0.2s ease;
    }}
    [data-testid="stMetric"]:hover {{
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }}

    /* Positive/negative deltas */
    [data-testid="stMetricDelta"] svg[data-testid="stArrowUp"] {{ fill: #16a34a; }}
    [data-testid="stMetricDelta"] svg[data-testid="stArrowDown"] {{ fill: #dc2626; }}

    /* Sidebar styling */
    [data-testid="stSidebar"] {{
        background: #f5f7fa;
        border-right: 1px solid #e2e8f0;
    }}

    /* Table styling */
    .stDataFrame table {{
        border-collapse: collapse;
    }}
    .stDataFrame th {{
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: {secondary};
    }}
    .stDataFrame tr:hover {{
        background: rgba(9, 124, 247, 0.03);
    }}

    /* Hide Streamlit branding */
    #MainMenu {{ visibility: hidden; }}
    footer {{ visibility: hidden; }}
    </style>""", unsafe_allow_html=True)

def inject_logo(logo_url: str, app_title: str):
    st.markdown(f"""
    <div style="display:flex; align-items:center; gap:12px; padding:8px 0 16px;">
        <img src="{logo_url}" style="height:32px;" />
        <span style="font-size:1.25rem; font-weight:600;">{app_title}</span>
    </div>
    """, unsafe_allow_html=True)
```

## Plotly Theme

```python
# utils/design.py
import plotly.graph_objects as go
import plotly.io as pio

def setup_plotly_theme(chart_colors):
    pio.templates["keboola"] = go.layout.Template(
        layout=go.Layout(
            colorway=chart_colors,
            font=dict(family="Plus Jakarta Sans, sans-serif", size=14),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            xaxis=dict(gridcolor="#e2e8f0", linecolor="#e2e8f0"),
            yaxis=dict(gridcolor="#e2e8f0", linecolor="#e2e8f0"),
            hoverlabel=dict(bgcolor="white", bordercolor="#e2e8f0"),
        )
    )
    pio.templates.default = "keboola"
```

## Page Module Template

```python
# page_modules/overview.py
import streamlit as st
import plotly.express as px
from utils.data_loader import execute_query, get_table_name

def create_overview():
    st.title("Overview")

    # Build WHERE clause with all active filters
    where_parts = ['"status" = \'active\'']
    # CUSTOMIZE: add filter clauses
    where_clause = ' AND '.join(where_parts)

    # KPI metrics
    kpis = execute_query(f'''
        SELECT
            COUNT(DISTINCT "user_id") as users,
            COUNT(*) as events,
            AVG("value") as avg_value
        FROM {get_table_name("out.c-data.events")}
        WHERE {where_clause}
    ''')

    if not kpis.empty:
        row = kpis.iloc[0]
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Users", f"{int(row['users']):,}")
        with col2:
            st.metric("Events", f"{int(row['events']):,}")
        with col3:
            st.metric("Avg Value", f"{row['avg_value']:.2f}")

    st.markdown("---")

    # Trend chart
    trends = execute_query(f'''
        SELECT DATE("date") as day, COUNT(*) as count
        FROM {get_table_name("out.c-data.events")}
        WHERE {where_clause}
        GROUP BY DATE("date")
        ORDER BY day
    ''')

    if not trends.empty:
        fig = px.line(trends, x="day", y="count", title="Daily Events", markers=True)
        st.plotly_chart(fig, use_container_width=True)
```

## Entry Point Template

```python
# streamlit_app.py
import streamlit as st
from utils.design import inject_theme, inject_logo, setup_plotly_theme
from page_modules.overview import create_overview
# CUSTOMIZE: import other pages

st.set_page_config(
    page_title="CUSTOMIZE: App Title",
    page_icon="📊",
    layout="wide",
)

# Apply theming
inject_theme(primary="#097cf7", secondary="#002151", accent="#CA8A04")
setup_plotly_theme(["#097cf7", "#CA8A04", "#1E3A8A", "#059669", "#DC2626", "#8b5cf6"])

# Logo
inject_logo("/app/static/logo.png", "CUSTOMIZE: App Title")

# Navigation
page = st.sidebar.radio("Navigation", ["Overview", "Trends"])
# CUSTOMIZE: add more pages

if page == "Overview":
    create_overview()
elif page == "Trends":
    pass  # CUSTOMIZE: create_trends()
```

## .streamlit/config.toml

```toml
[theme]
primaryColor = "#097cf7"
backgroundColor = "#ffffff"
secondaryBackgroundColor = "#f5f7fa"
textColor = "#000000"
font = "sans serif"

[server]
headless = true
enableCORS = false
```

## SQL Best Practices

- **Quote all identifiers**: `"column_name"` (Snowflake is case-sensitive)
- **Fully qualified table names**: `get_table_name("out.c-bucket.table")`
- **Date filters on time-series**: `WHERE "date" >= CURRENT_DATE - INTERVAL '90 days'`
- **Handle NULLs**: `COALESCE("column", 'Unknown')`
- **Check SQL dialect first**: `{MCP_TOOL_PREFIX}get_project_info` → Snowflake vs BigQuery
- **Cache all queries**: `@st.cache_data(ttl=300)`

## Common Pitfalls

- **Variable name conflicts**: Use `user_type_sql_filter` vs `user_type_multiselect`
- **Session state key collisions**: Use unique keys like `"local_category_filter"`
- **Empty DataFrames**: Always check `if not df.empty:` before accessing data
- **`nonlocal` in module scope**: Extract async logic into standalone functions (for Kai)
