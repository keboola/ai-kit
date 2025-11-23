# Best Practices for Developing Keboola Data Apps Locally

A comprehensive guide for building Streamlit data apps that seamlessly transition from local development to Keboola production deployment.

## 📁 Project Structure

### Recommended Layout

When starting a new Keboola data app project, use this structure:

```
my-keboola-dataapp/
├── streamlit_app.py              # Main entry point
├── pyproject.toml                # Project metadata & dependencies
├── requirements.txt              # Pip dependencies (generated)
├── uv.lock                       # Lock file (if using uv)
├── .gitignore                    # Exclude secrets, cache, etc.
├── README.md                     # Project documentation
│
├── .streamlit/
│   ├── config.toml              # Streamlit configuration
│   └── secrets.toml             # Local credentials (NEVER commit)
│
├── utils/
│   ├── __init__.py
│   ├── data_loader.py           # Data access layer
│   ├── common.py                # Shared utilities
│   └── visualization.py         # Reusable chart functions
│
├── page_modules/
│   ├── __init__.py
│   ├── overview.py              # Homepage/overview
│   ├── analysis_one.py          # Feature page 1
│   └── analysis_two.py          # Feature page 2
│
├── tests/                        # Test suite
│   ├── __init__.py
│   ├── test_data_loader.py
│   └── test_page_modules.py
│
└── docs/
    ├── QUICKSTART.md            # Getting started guide
    ├── DEPLOYMENT.md            # Deployment instructions
    └── DEVELOPMENT.md           # Development guide
```

### File Naming Conventions

- **Snake_case for Python files**: `data_loader.py`, `analysis_page.py`
- **Descriptive names**: `create_revenue_chart()`, not `make_plot()`
- **Module prefixes**: `page_overview.py`, `page_analysis.py`

### .gitignore Template

```gitignore
# Secrets
.streamlit/secrets.toml
*.env
.env.*

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python

# Virtual environments
venv/
env/
ENV/

# IDE
.vscode/
.idea/
*.swp
*.swo

# Streamlit
.streamlit/cache/

# OS
.DS_Store
Thumbs.db
```

## ⚙️ Configuration Management

### Local Development Setup

Create `.streamlit/secrets.toml`:

```toml
# Keboola Connection
KBC_URL = "https://connection.{region}.keboola.com"
KBC_TOKEN = "your-storage-api-token"
KBC_WORKSPACE_ID = 12345
KBC_DATABASE_NAME = "KBC_REGION_PROJECTID"

# Optional: Application-specific settings
CACHE_TTL = 300
DEFAULT_DATE_RANGE = 90
```

Access in code:

```python
import streamlit as st

# Keboola credentials
kbc_url = st.secrets["KBC_URL"]
kbc_token = st.secrets["KBC_TOKEN"]
workspace_id = st.secrets.get("KBC_WORKSPACE_ID")

# Application settings
cache_ttl = st.secrets.get("CACHE_TTL", 300)  # Default: 5 min
```

### Production (Keboola) Setup

Keboola automatically injects environment variables:

```python
import os
import streamlit as st

def get_config(key: str, default=None):
    """
    Get configuration from secrets (local) or environment (production).

    Args:
        key: Configuration key
        default: Default value if not found

    Returns:
        Configuration value
    """
    # Try secrets first (local development)
    if key in st.secrets:
        return st.secrets[key]

    # Fall back to environment variables (production)
    return os.environ.get(key, default)

# Usage
kbc_url = get_config("KBC_URL")
kbc_token = get_config("KBC_TOKEN")
workspace_id = get_config("KBC_WORKSPACE_ID")
```

## 🎯 Core Principles

### 1. SQL-First Architecture
**Push computation to the data warehouse, not the application layer.**

**Benefits:**
- ⚡ **Performance**: Server-side aggregation scales with data size
- 📈 **Scalability**: Performance independent of dataset size
- 💾 **Efficiency**: Minimal data transfer, only results transmitted
- 🔄 **Maintainability**: Business logic in SQL, easier to optimize

**Anti-pattern:**
```python
# ❌ BAD: Load all data, process in Python
df = pd.read_sql("SELECT * FROM large_table", conn)
result = df.groupby('category').agg({'value': 'sum'})
```

**Best practice:**
```python
# ✅ GOOD: Aggregate in database
query = """
    SELECT category, SUM(value) as total
    FROM large_table
    GROUP BY category
"""
result = execute_query(query)
```

### 2. Environment Parity
**Local development should mirror production as closely as possible.**

- Same data sources (workspace tables)
- Same authentication pattern
- Same dependencies
- Same file structure
- Different only in credential storage mechanism

### 3. Modular Design
**Separate concerns for maintainability and reusability.**

```
streamlit_app.py          # Entry point, navigation, layout
├── utils/                # Shared utilities
│   ├── data_loader.py    # Data access layer
│   └── common.py         # Helper functions
└── page_modules/         # Feature-specific logic
    ├── overview.py
    └── analysis.py
```

## 🏗️ Architecture Patterns

### Data Access Layer Pattern

```python
# utils/data_loader.py

import streamlit as st
import pandas as pd
import requests
import os

@st.cache_data(ttl=300)  # 5-minute cache
def execute_aggregation_query(sql: str) -> pd.DataFrame:
    """
    Execute SQL query via Keboola Workspace API.

    Args:
        sql: SQL query string

    Returns:
        pandas DataFrame with query results
    """
    kbc_url = os.environ.get('KBC_URL') or st.secrets.get("KBC_URL")
    kbc_token = os.environ.get('KBC_TOKEN') or st.secrets.get("KBC_TOKEN")
    workspace_id = os.environ.get('KBC_WORKSPACE_ID') or st.secrets.get("KBC_WORKSPACE_ID")

    endpoint = f"{kbc_url}/v2/storage/workspaces/{workspace_id}/query"
    headers = {
        "X-StorageApi-Token": kbc_token,
        "Content-Type": "application/json"
    }

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
    """
    Get fully qualified table name for SQL queries.

    Args:
        table_id: Storage table ID (e.g., 'out.c-bucket.table')

    Returns:
        Properly quoted table name for SQL queries
    """
    last_dot_index = table_id.rfind(".")
    if last_dot_index > 0:
        bucket = table_id[:last_dot_index]
        table = table_id[last_dot_index + 1:]
        table_normalized = table.replace("-", "_")
        return f'"{bucket}"."{table_normalized}"'
    else:
        return f'"{table_id}"'
```

### Page Module Pattern

```python
# page_modules/analysis_page.py

"""Analysis Page - Descriptive title of page purpose"""

import streamlit as st
import plotly.express as px
from utils.data_loader import execute_aggregation_query, get_table_name

def create_analysis_page():
    """Main entry point for analysis page."""
    st.title("📊 Analysis Page")

    # Load data
    data = load_page_data()

    # Handle empty state
    if data.empty:
        st.warning("No data available for analysis")
        return

    # Create sections
    create_summary_section(data)
    create_visualization_section(data)

@st.cache_data(ttl=300)
def load_page_data() -> pd.DataFrame:
    """Load data specific to this page."""
    query = f"""
        SELECT
            category,
            COUNT(*) as count,
            AVG(value) as avg_value
        FROM {get_table_name('out.c-bucket.data_table')}
        WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY category
        ORDER BY count DESC
    """
    return execute_aggregation_query(query)

def create_summary_section(data: pd.DataFrame):
    """Display summary metrics."""
    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Total Categories", len(data))
    with col2:
        st.metric("Total Count", data['count'].sum())
    with col3:
        st.metric("Average Value", f"{data['avg_value'].mean():.2f}")

def create_visualization_section(data: pd.DataFrame):
    """Create visualizations."""
    fig = px.bar(
        data,
        x='category',
        y='count',
        title='Distribution by Category'
    )
    st.plotly_chart(fig, use_container_width=True)
```

## 💾 Data Access Patterns

### Query Best Practices

#### 1. Server-Side Aggregation
```python
# ✅ GOOD: Aggregate in database
query = """
    SELECT
        DATE_TRUNC('day', event_date) as date,
        category,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(value) as avg_value
    FROM {table_name}
    WHERE event_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE_TRUNC('day', event_date), category
    ORDER BY date DESC
"""
```

#### 2. Use Date Filters
```python
# ✅ Always limit time range for large tables
def build_date_filter(days: int = 90) -> str:
    """Build standard date filter clause."""
    return f"event_date >= CURRENT_DATE - INTERVAL '{days} days'"
```

#### 3. Parameterized Queries
```python
def build_where_clause(filters: dict) -> str:
    """Build WHERE clause from filter dictionary."""
    where_parts = []

    for key, value in filters.items():
        if value:  # Only add non-empty filters
            where_parts.append(value)

    return ' AND '.join(where_parts) if where_parts else '1=1'

# Usage
where_parts = ['"type" = \'success\'', get_agent_filter_clause()]
user_filter = get_user_type_filter_clause()
if user_filter:
    where_parts.append(user_filter)
where_clause = ' AND '.join(where_parts)
```

### Caching Strategy

```python
# Standard caching for data loads
@st.cache_data(ttl=300)  # 5 minutes
def load_hourly_metrics() -> pd.DataFrame:
    """Load metrics that update frequently."""
    return execute_aggregation_query(query)

# Longer caching for reference data
@st.cache_data(ttl=3600)  # 1 hour
def load_reference_data() -> pd.DataFrame:
    """Load slowly-changing reference data."""
    return execute_aggregation_query(query)
```

## ⚙️ Configuration Management

### Local Development Setup

**Create `.streamlit/secrets.toml`:**

```toml
# Keboola Connection
KBC_URL = "https://connection.{region}.keboola.com"
KBC_TOKEN = "your-storage-api-token"
KBC_WORKSPACE_ID = 12345
KBC_DATABASE_NAME = "KBC_REGION_PROJECTID"

# Optional: Application-specific settings
CACHE_TTL = 300
DEFAULT_DATE_RANGE = 90
```

### Environment-Agnostic Pattern

```python
import os
import streamlit as st

# Works in both local and production
kbc_url = os.environ.get('KBC_URL') or st.secrets.get("KBC_URL")
kbc_token = os.environ.get('KBC_TOKEN') or st.secrets.get("KBC_TOKEN")
workspace_id = os.environ.get('KBC_WORKSPACE_ID') or st.secrets.get("KBC_WORKSPACE_ID")
```

## 📁 Project Structure

```
my-keboola-dataapp/
├── streamlit_app.py              # Main entry point
├── pyproject.toml                # Project metadata & dependencies
├── requirements.txt              # Pip dependencies
├── .gitignore                    # Exclude secrets, cache
│
├── .streamlit/
│   ├── config.toml              # Streamlit configuration
│   └── secrets.toml             # Local credentials (NEVER commit)
│
├── utils/
│   ├── __init__.py
│   └── data_loader.py           # Data access layer
│
├── page_modules/
│   ├── __init__.py
│   ├── overview.py              # Homepage/overview
│   └── analysis.py              # Feature pages
│
└── .claude/
    └── skills/
        └── keboola-dataapp-dev/  # This skill
```

## 🚀 Performance Optimization

### Query Optimization Checklist

- [ ] **Aggregate in database**, not Python
- [ ] **Add date range filters** for time-series data
- [ ] **Use LIMIT** during development/testing
- [ ] **Select only needed columns**, not `SELECT *`
- [ ] **Cache frequently-accessed queries**
- [ ] **Test with production data volumes**

## 🐛 Common Issues and Solutions

### Issue: Variable Name Conflicts
**Solution**: Use descriptive, unique variable names. Add prefixes like `sql_`, `local_`, `global_` to differentiate.

### Issue: Session State Key Collisions
**Solution**: Use unique keys for widgets: `key="local_filter"` instead of `key="filter"`

### Issue: Empty DataFrames
**Solution**: Always validate data exists before processing:
```python
if data.empty:
    st.warning("No data available")
    return
```

### Issue: Slow Query Performance
**Solution**:
1. Add date filters to limit data
2. Use aggregation in SQL
3. Increase cache TTL
4. Test queries with `mcp__keboola__query_data` first

## ✅ Success Criteria

Your implementation is complete when:

- ✅ Data validated with Keboola MCP
- ✅ Code follows SQL-first architecture
- ✅ All page modules updated consistently
- ✅ Session state initialized properly
- ✅ No variable name conflicts
- ✅ Visually verified with Playwright
- ✅ All pages tested and working
- ✅ No errors in console
- ✅ Ready to commit and push
