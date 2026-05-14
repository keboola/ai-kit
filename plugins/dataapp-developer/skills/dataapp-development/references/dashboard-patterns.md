# Dashboard Patterns

**Use this when:** you're building a dashboarding-style app with sidebar filters, charts, metrics, and tables.

## SQL-first aggregation

Push computation to the database; never load raw data into the app. Show good vs bad side-by-side:

```python
# BAD — load 2M rows, aggregate in Python
df = execute_query("SELECT * FROM large_table")
result = df.groupby('category').agg({'value': 'mean'})

# GOOD — aggregate in SQL, transfer only the summary
query = f'''
    SELECT
        "category",
        COUNT(*) as count,
        AVG("value") as avg_value
    FROM {get_table_name()}
    WHERE "date" >= CURRENT_DATE - INTERVAL '90 days'
        AND {get_filter_clause()}
    GROUP BY "category"
'''
result = execute_query(query)
```

Why: Snowflake (and similar warehouses) are optimised for this. Loading rows into Python serializes them over the network and burns app memory. SQL aggregation stays in the engine where the data already lives.

Always include a date range filter on time-series queries — otherwise you risk scanning the entire table.

Rules of thumb:
- Aggregate (`GROUP BY`, `AVG`, `SUM`, `COUNT`, `PERCENTILE_CONT`) in SQL.
- Pivot, rank, and window-function in SQL (`ROW_NUMBER`, `LAG`, `LEAD`).
- Limit result sets to display dimensions (`LIMIT 1000` is a reasonable ceiling for a table view; charts need far fewer points).
- Only do row-level work in Python when the SQL dialect can't express it (e.g. parsing irregular JSON blobs).
- If you find yourself loading more than ~50k rows into the app, the query is wrong — push more work down.

## Sidebar global filters

Store filter selections in app-level state (Streamlit: `st.session_state`; React/Next.js: URL search params or React Query state; vanilla JS: in-memory object + URL hash).

Pattern from agent-usage-data-app (Streamlit):

```python
# Initialize default
if 'user_type_filter' not in st.session_state:
    st.session_state.user_type_filter = 'External Users Only'

# Create UI control
option = st.sidebar.radio(
    "User type:",
    options=['External Users Only', 'Keboola Users Only', 'All Users'],
    index=['External Users Only', 'Keboola Users Only', 'All Users'].index(
        st.session_state.user_type_filter
    ),
)

# Update + rerun on change
if option != st.session_state.user_type_filter:
    st.session_state.user_type_filter = option
    st.rerun()
```

For multi-page apps, use a centralized filter-clause builder so every page module gets the same SQL fragment:

```python
def get_user_type_filter_clause() -> str:
    """Return a SQL WHERE fragment for the current user-type filter, or empty string."""
    if 'user_type_filter' not in st.session_state:
        st.session_state.user_type_filter = 'External Users Only'
    if st.session_state.user_type_filter == 'External Users Only':
        return '"user_type" = \'External User\''
    elif st.session_state.user_type_filter == 'Keboola Users Only':
        return '"user_type" != \'External User\''
    return ''  # All Users
```

## Per-page module layout (Streamlit)

```
streamlit_app.py          # entry, navigation, global filters
page_modules/             # individual pages
  overview.py
  cost_analysis.py
  user_engagement.py
utils/
  data_loader.py          # SQL execution + filter-clause builders
  common.py               # shared utilities
```

Global WHERE-clause-builder pattern — assemble per page:

```python
where_parts = ['"status" = \'success\'', get_agent_filter_clause()]
user_filter = get_user_type_filter_clause()
if user_filter:
    where_parts.append(user_filter)
where_clause = ' AND '.join(where_parts)

query = f'''
    SELECT ...
    FROM {get_table_name()}
    WHERE {where_clause}
'''
```

For non-Streamlit dashboards (single Node + static frontend), put filter assembly in `api/queries.js` and pass filter values from the frontend as query params (`/api/summary?user_type=external&period=l3m`).

## Charts

- **Streamlit:** Plotly Express (`px.line`, `px.bar`, `px.pie`) for quick iteration. Plotly Graph Objects (`go.Figure`, `go.Scatter`) for finer control.
- **React / Next.js:** ECharts via `echarts-for-react` (preferred — extremely customisable, performant on large datasets). Register a custom theme once at app init.
- **Vanilla JS:** Chart.js (via CDN). Simple API, good defaults.

Common rules across all:
- Set a single brand color in one place. Don't sprinkle hex codes across components.
- Configure `responsive: true` / `use_container_width=True` so charts adapt to viewport.
- Hide redundant chart elements (no legend for single-series, no axis title that repeats the chart title).
- Format axis ticks via the chart library's tick-formatter (don't pre-format numbers to strings before passing them in — that breaks hover tooltips and zoom).
- For time-series, prefer line over bar above ~30 points; switch to bar for small categorical comparisons.

## Empty / loading / error states

Every data-fetching component must explicitly handle three states:

- **Loading** — show a skeleton placeholder with fixed dimensions matching the eventual content. Never an empty container that snaps to size when data arrives (causes CLS).
- **Empty** — `if data.empty:` (Streamlit) / `if (!data.length)` (JS). Show a friendly message ("No data for the selected filters"), NOT a blank space.
- **Error** — `try/except` (or `try/catch`); show what failed and an action ("Retry" button or "Check filters and try again").

Streamlit example:
```python
data = load_metrics(where_clause)
if data.empty:
    st.warning("No data matches the selected filters.")
    return
# render charts...
```

React example:
```javascript
if (isLoading) return <ChartSkeleton height={320} />;
if (error) return <ErrorPanel message={error.message} onRetry={refetch} />;
if (!data?.length) return <EmptyState text="No data for the selected filters." />;
return <Chart data={data} />;
```

Don't conflate empty and error. "Query succeeded, returned zero rows" is a user-fixable filter problem; "query threw an exception" is a system problem. Showing the same generic message for both teaches users to ignore it.

## Number / currency / percent formatting

Use a single formatter helper. Never `.toFixed()` or `f"{x:.2f}"` scattered throughout components.

Streamlit:
```python
# utils/common.py
def format_currency(value: float) -> str:
    return f"${value:,.2f}"

def format_percent(value: float) -> str:
    return f"{value * 100:.1f}%"

def format_count(value: int) -> str:
    return f"{value:,}"
```

JS:
```javascript
// lib/constants.js
export const formatCurrency = (v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const formatPercent = (v, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const formatCount = (v) => v.toLocaleString('en-US');
```

When you change formatting (e.g. show currency in EUR), edit the helper once. Otherwise you'll miss a component six months later.

## Sortable tables

Keep numeric columns numeric throughout the pipeline. Streamlit's `st.dataframe` sorts by COLUMN TYPE — if a currency column is stored as the string `"$1,234.56"`, sorting falls back to alphabetical and the user sees `$1,000` between `$100` and `$2,000`.

Use Streamlit's column config to display formatted currency while preserving numeric sort:

```python
st.dataframe(
    df,
    column_config={
        "revenue": st.column_config.NumberColumn(
            "Revenue",
            format="$%.2f",
        ),
        "growth_rate": st.column_config.NumberColumn(
            "Growth",
            format="%.1f%%",
        ),
    },
    use_container_width=True,
)
```

Same principle for React tables: store as `number`, format only at render time. Whatever table library you pick (TanStack Table, AG Grid, MUI DataGrid), pass raw numeric values and use a `cell` renderer for display formatting; set the column's `sortingFn: 'basic'` (or equivalent) so the library compares numbers, not their formatted strings.

Quick checklist before shipping a sortable table:
- Click each numeric column header — does it sort numerically (1, 2, 10, 100), not alphabetically (1, 10, 100, 2)?
- Are NULL/NaN values handled (sent to the bottom on ascending sort, top on descending)?
- Is the formatter consistent with the rest of the dashboard (same helper from `utils/common.py` or `lib/constants.js`)?
