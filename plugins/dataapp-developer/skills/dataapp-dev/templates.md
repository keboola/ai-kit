# Code Templates for Keboola Data Apps

Reusable code templates following best practices for Streamlit + Keboola development.

## Table of Contents

- [Filter Function Templates](#filter-function-templates)
- [Page Module Templates](#page-module-templates)
- [Query Pattern Templates](#query-pattern-templates)
- [UI Component Templates](#ui-component-templates)
- [Data Loader Templates](#data-loader-templates)

---

## Filter Function Templates

### Basic Filter Function (utils/data_loader.py)

```python
def get_filter_name_clause():
    """
    Get SQL WHERE clause for [filter description].

    Returns:
        String with SQL WHERE clause or empty string if no filter applied.
    """
    # Initialize session state with default
    if 'filter_name' not in st.session_state:
        st.session_state.filter_name = 'Default Option'

    selected = st.session_state.filter_name

    if selected == 'Option 1':
        return '"column_name" = \'value1\''
    elif selected == 'Option 2':
        return '"column_name" = \'value2\''
    else:  # All / No filter
        return ''
```

### Multi-Condition Filter Function

```python
def get_multi_filter_clause():
    """
    Get SQL WHERE clause supporting multiple filter conditions.

    Returns:
        String with SQL WHERE clause combining multiple conditions.
    """
    if 'multi_filter' not in st.session_state:
        st.session_state.multi_filter = {
            'category': 'All',
            'status': 'Active',
            'region': 'All'
        }

    filters = st.session_state.multi_filter
    where_parts = []

    if filters['category'] != 'All':
        where_parts.append(f'"category" = \'{filters["category"]}\'')

    if filters['status'] != 'All':
        where_parts.append(f'"status" = \'{filters["status"]}\'')

    if filters['region'] != 'All':
        where_parts.append(f'"region" = \'{filters["region"]}\'')

    return ' AND '.join(where_parts) if where_parts else ''
```

### Date Range Filter Function

```python
def get_date_filter_clause():
    """
    Get SQL WHERE clause for date range filter.

    Returns:
        String with SQL date filter clause.
    """
    if 'date_range' not in st.session_state:
        st.session_state.date_range = 'Last 90 Days'

    date_range = st.session_state.date_range

    if date_range == 'Last 7 Days':
        return 'TO_TIMESTAMP("event_date") >= CURRENT_DATE - INTERVAL \'7 days\''
    elif date_range == 'Last 30 Days':
        return 'TO_TIMESTAMP("event_date") >= CURRENT_DATE - INTERVAL \'30 days\''
    elif date_range == 'Last 90 Days':
        return 'TO_TIMESTAMP("event_date") >= CURRENT_DATE - INTERVAL \'90 days\''
    elif date_range == 'Last Year':
        return 'TO_TIMESTAMP("event_date") >= CURRENT_DATE - INTERVAL \'1 year\''
    else:  # All Time
        return ''
```

---

## Page Module Templates

### Minimal Page Module

```python
"""Page Name - Brief description"""
import streamlit as st
import pandas as pd
import plotly.express as px
from utils.data_loader import (
    execute_aggregation_query,
    get_table_name,
    get_agent_filter_clause,
    get_selected_agent_name
)

def create_page_name():
    """Create the page."""

    selected_agent = get_selected_agent_name()
    st.title(f"📊 Page Title: {selected_agent}")
    st.markdown("---")

    # Build WHERE clause
    where_parts = ['"type" = \'success\'', get_agent_filter_clause()]
    where_clause = ' AND '.join(where_parts)

    # Load and display data
    metrics = load_metrics(where_clause)
    display_metrics(metrics)

@st.cache_data(ttl=300)
def load_metrics(where_clause: str) -> pd.DataFrame:
    """Load metrics for this page."""
    query = f'''
        SELECT
            COUNT(*) as total_events,
            COUNT(DISTINCT "user_name") as users
        FROM {get_table_name()}
        WHERE {where_clause}
    '''
    return execute_aggregation_query(query)

def display_metrics(data: pd.DataFrame):
    """Display metrics section."""
    if data.empty:
        st.warning("No data available")
        return

    row = data.iloc[0]

    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total Events", f"{int(row['total_events']):,}")
    with col2:
        st.metric("Unique Users", f"{int(row['users']):,}")
```

### Full-Featured Page Module

```python
"""Page Name - Comprehensive analysis page"""
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from utils.data_loader import (
    execute_aggregation_query,
    get_table_name,
    get_agent_filter_clause,
    get_user_type_filter_clause,
    get_selected_agent_name
)

def create_page_name():
    """Create comprehensive analysis page."""

    selected_agent = get_selected_agent_name()
    st.title(f"📊 Page Title: {selected_agent}")
    st.markdown("Detailed description of page purpose")
    st.markdown("---")

    # Build WHERE clause with all filters
    where_parts = ['"type" = \'success\'', get_agent_filter_clause()]
    user_type_filter = get_user_type_filter_clause()
    if user_type_filter:
        where_parts.append(user_type_filter)
    where_clause = ' AND '.join(where_parts)

    # Section 1: Overview metrics
    st.markdown("## 📈 Overview")
    create_overview_section(where_clause)

    st.markdown("---")

    # Section 2: Trends
    st.markdown("## 📊 Trends")
    create_trends_section(where_clause)

    st.markdown("---")

    # Section 3: Details
    st.markdown("## 📋 Detailed Data")
    create_details_section(where_clause)

def create_overview_section(where_clause: str):
    """Display overview metrics."""
    metrics_query = f'''
        SELECT
            COUNT(*) as total_events,
            COUNT(DISTINCT "user_name") as users,
            COUNT(DISTINCT "project_id") as projects,
            AVG("value") as avg_value
        FROM {get_table_name()}
        WHERE {where_clause}
    '''

    metrics = execute_aggregation_query(metrics_query)

    if not metrics.empty:
        row = metrics.iloc[0]

        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric("Total Events", f"{int(row['total_events']):,}",
                     help="Total number of events in selected period")

        with col2:
            st.metric("Unique Users", f"{int(row['users']):,}",
                     help="Number of distinct users")

        with col3:
            st.metric("Projects", f"{int(row['projects']):,}",
                     help="Number of distinct projects")

        with col4:
            st.metric("Average Value", f"{row['avg_value']:.2f}",
                     help="Mean value across all events")

def create_trends_section(where_clause: str):
    """Display trend analysis."""
    trend_query = f'''
        SELECT
            DATE_TRUNC('day', TO_TIMESTAMP("event_date")) as date,
            COUNT(*) as events,
            COUNT(DISTINCT "user_name") as users
        FROM {get_table_name()}
        WHERE {where_clause}
            AND TO_TIMESTAMP("event_date") >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', TO_TIMESTAMP("event_date"))
        ORDER BY date
    '''

    trends = execute_aggregation_query(trend_query)

    if not trends.empty and len(trends) > 1:
        col1, col2 = st.columns(2)

        with col1:
            fig = px.line(
                trends,
                x='date',
                y='events',
                title='Daily Events',
                markers=True
            )
            st.plotly_chart(fig, use_container_width=True)

        with col2:
            fig = px.line(
                trends,
                x='date',
                y='users',
                title='Daily Active Users',
                markers=True
            )
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Not enough data for trend analysis")

def create_details_section(where_clause: str):
    """Display detailed data table."""
    details_query = f'''
        SELECT
            "user_name",
            "category",
            COUNT(*) as events,
            MIN(TO_TIMESTAMP("event_date")) as first_seen,
            MAX(TO_TIMESTAMP("event_date")) as last_seen
        FROM {get_table_name()}
        WHERE {where_clause}
        GROUP BY "user_name", "category"
        ORDER BY events DESC
        LIMIT 100
    '''

    details = execute_aggregation_query(details_query)

    if not details.empty:
        # Add interactive filters
        col1, col2 = st.columns(2)

        with col1:
            min_events = st.number_input("Min Events:", min_value=0, value=0)

        with col2:
            categories = details['category'].unique().tolist()
            selected_categories = st.multiselect(
                "Filter Categories:",
                options=categories,
                default=categories,
                key="detail_category_filter"
            )

        # Apply filters
        filtered = details[
            (details['events'] >= min_events) &
            (details['category'].isin(selected_categories))
        ]

        st.dataframe(filtered, use_container_width=True, height=400)

        # Download button
        csv = filtered.to_csv(index=False)
        st.download_button(
            label="📥 Download as CSV",
            data=csv,
            file_name="details.csv",
            mime="text/csv"
        )
    else:
        st.info("No detail data available")
```

---

## Query Pattern Templates

### Basic Aggregation Query

```python
query = f'''
    SELECT
        "category",
        COUNT(*) as event_count,
        COUNT(DISTINCT "user_id") as unique_users,
        AVG("value") as avg_value,
        SUM("amount") as total_amount
    FROM {get_table_name()}
    WHERE {where_clause}
    GROUP BY "category"
    ORDER BY event_count DESC
'''
```

### Time-Series Aggregation

```python
query = f'''
    SELECT
        DATE_TRUNC('day', TO_TIMESTAMP("event_date")) as date,
        COUNT(*) as daily_events,
        COUNT(DISTINCT "user_id") as daily_active_users,
        AVG("value") as daily_avg_value
    FROM {get_table_name()}
    WHERE {where_clause}
        AND TO_TIMESTAMP("event_date") >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE_TRUNC('day', TO_TIMESTAMP("event_date"))
    ORDER BY date ASC
'''
```

### Top N Query with Percentage

```python
query = f'''
    SELECT
        "category",
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
    FROM {get_table_name()}
    WHERE {where_clause}
    GROUP BY "category"
    ORDER BY count DESC
    LIMIT 10
'''
```

### Conditional Aggregation

```python
query = f'''
    SELECT
        "category",
        COUNT(*) as total,
        SUM(CASE WHEN "status" = 'success' THEN 1 ELSE 0 END) as successes,
        SUM(CASE WHEN "status" = 'error' THEN 1 ELSE 0 END) as errors,
        ROUND(SUM(CASE WHEN "status" = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
    FROM {get_table_name()}
    WHERE {where_clause}
    GROUP BY "category"
    ORDER BY total DESC
'''
```

### Window Function Query

```python
query = f'''
    WITH ranked_data AS (
        SELECT
            "user_name",
            "event_date",
            "value",
            ROW_NUMBER() OVER (PARTITION BY "user_name" ORDER BY "event_date" DESC) as row_num
        FROM {get_table_name()}
        WHERE {where_clause}
    )
    SELECT
        "user_name",
        "event_date" as last_event_date,
        "value" as last_value
    FROM ranked_data
    WHERE row_num = 1
    ORDER BY "event_date" DESC
'''
```

### Join Query with Multiple Tables

```python
# When you need data from multiple tables
events_table = get_table_name('out.c-bucket.events')
users_table = get_table_name('out.c-bucket.users')

query = f'''
    SELECT
        e."event_id",
        e."event_type",
        e."event_date",
        u."user_name",
        u."user_tier",
        u."organization"
    FROM {events_table} e
    LEFT JOIN {users_table} u
        ON e."user_id" = u."user_id"
    WHERE {where_clause}
    ORDER BY e."event_date" DESC
    LIMIT 1000
'''
```

---

## UI Component Templates

### Global Filter in Sidebar (streamlit_dashboard.py)

```python
# Add after existing filters, before navigation

st.sidebar.markdown("---")
st.sidebar.markdown("**🎯 Filter Label**")

# Initialize session state
if 'filter_name' not in st.session_state:
    st.session_state.filter_name = 'Default Value'

# Create radio button
filter_option = st.sidebar.radio(
    "Select option:",
    options=['Option 1', 'Option 2', 'All'],
    index=['Option 1', 'Option 2', 'All'].index(st.session_state.filter_name),
    help="Description of what this filter does and when to use each option."
)

# Update session state and rerun if changed
if filter_option != st.session_state.filter_name:
    st.session_state.filter_name = filter_option
    st.rerun()

st.sidebar.markdown("---")
```

### Date Range Selector

```python
st.sidebar.markdown("**📅 Date Range**")

if 'date_range' not in st.session_state:
    st.session_state.date_range = 'Last 90 Days'

date_options = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Last Year', 'All Time']

date_range = st.sidebar.selectbox(
    "Select date range:",
    options=date_options,
    index=date_options.index(st.session_state.date_range)
)

if date_range != st.session_state.date_range:
    st.session_state.date_range = date_range
    st.rerun()
```

### Multi-Select Filter

```python
st.sidebar.markdown("**🏷️ Categories**")

if 'selected_categories' not in st.session_state:
    st.session_state.selected_categories = []

# Get available categories from data
available_categories = get_available_categories()

selected = st.sidebar.multiselect(
    "Filter by categories:",
    options=available_categories,
    default=st.session_state.selected_categories or available_categories,
    help="Select one or more categories to filter data"
)

if selected != st.session_state.selected_categories:
    st.session_state.selected_categories = selected
    st.rerun()
```

### Metrics Display Grid

```python
# 3-column metric layout
col1, col2, col3 = st.columns(3)

with col1:
    st.metric(
        "Metric 1",
        f"{value1:,}",
        delta=f"{change_pct:.1f}%",
        help="Description of what this metric represents"
    )

with col2:
    st.metric(
        "Metric 2",
        f"${value2:.2f}",
        help="Description of metric 2"
    )

with col3:
    st.metric(
        "Metric 3",
        f"{value3:.1f}%",
        help="Description of metric 3"
    )
```

### Expandable Detail Section

```python
with st.expander("📋 View Detailed Data"):
    st.markdown("### Additional Context")

    # Show detailed table
    st.dataframe(
        detailed_df,
        use_container_width=True,
        height=400,
        hide_index=True
    )

    # Download option
    csv = detailed_df.to_csv(index=False)
    st.download_button(
        label="📥 Download as CSV",
        data=csv,
        file_name=f"details_{datetime.now().strftime('%Y%m%d')}.csv",
        mime="text/csv"
    )
```

---

## Data Loader Templates

### Query Execution with Error Handling

```python
@st.cache_data(ttl=300)
def load_data_safe(where_clause: str) -> pd.DataFrame:
    """
    Load data with comprehensive error handling.

    Args:
        where_clause: SQL WHERE clause

    Returns:
        DataFrame with results or empty DataFrame on error
    """
    query = f'''
        SELECT *
        FROM {get_table_name()}
        WHERE {where_clause}
    '''

    try:
        df = execute_aggregation_query(query)

        if df.empty:
            st.info("No data found matching the criteria")
            return pd.DataFrame()

        return df

    except Exception as e:
        st.error(f"Failed to load data: {str(e)}")

        # Show query for debugging
        with st.expander("Query Details"):
            st.code(query, language='sql')

        return pd.DataFrame()
```

### Multi-Table Data Loader

```python
@st.cache_data(ttl=300)
def load_combined_data(where_clause: str) -> pd.DataFrame:
    """
    Load and combine data from multiple sources.

    Args:
        where_clause: SQL WHERE clause to apply

    Returns:
        Combined DataFrame
    """
    # Load primary data
    primary = execute_aggregation_query(f'''
        SELECT *
        FROM {get_table_name('out.c-main.events')}
        WHERE {where_clause}
    ''')

    if primary.empty:
        return pd.DataFrame()

    # Load reference data
    reference = execute_aggregation_query(f'''
        SELECT *
        FROM {get_table_name('out.c-main.users')}
    ''')

    # Merge
    if not reference.empty:
        combined = primary.merge(
            reference,
            on='user_id',
            how='left'
        )
        return combined

    return primary
```

### Available Options Loader

```python
@st.cache_data(ttl=300)
def get_available_categories() -> list:
    """
    Get list of available categories from database.

    Returns:
        Sorted list of category values
    """
    query = f'''
        SELECT DISTINCT "category"
        FROM {get_table_name()}
        WHERE "category" IS NOT NULL
            AND "category" != ''
        ORDER BY "category"
    '''

    try:
        df = execute_aggregation_query(query)
        if not df.empty and 'category' in df.columns:
            return df['category'].tolist()
        return []
    except Exception as e:
        st.error(f"Error loading categories: {e}")
        return []
```

---

## Visualization Templates

### Line Chart with Markers

```python
fig = px.line(
    data,
    x='date',
    y='value',
    title='Trend Over Time',
    labels={'value': 'Value', 'date': 'Date'},
    markers=True
)
fig.update_layout(
    hovermode='x unified',
    height=400
)
st.plotly_chart(fig, use_container_width=True)
```

### Bar Chart with Color Coding

```python
fig = px.bar(
    data,
    x='category',
    y='count',
    color='metric',
    title='Distribution by Category',
    labels={'count': 'Count', 'category': 'Category'},
    color_continuous_scale='Blues'
)
fig.update_xaxes(tickangle=-45)
st.plotly_chart(fig, use_container_width=True)
```

### Pie Chart with Hole

```python
fig = px.pie(
    data,
    values='count',
    names='category',
    title='Distribution by Category',
    hole=0.4  # Donut chart
)
st.plotly_chart(fig, use_container_width=True)
```

### Multi-Line Chart

```python
fig = go.Figure()

fig.add_trace(go.Scatter(
    x=data['date'],
    y=data['metric1'],
    name='Metric 1',
    mode='lines+markers',
    line=dict(color='#1f77b4', width=2)
))

fig.add_trace(go.Scatter(
    x=data['date'],
    y=data['metric2'],
    name='Metric 2',
    mode='lines+markers',
    line=dict(color='#ff7f0e', width=2)
))

fig.update_layout(
    title='Comparison Over Time',
    xaxis_title='Date',
    yaxis_title='Value',
    hovermode='x unified',
    height=400
)

st.plotly_chart(fig, use_container_width=True)
```

### Histogram with Threshold Lines

```python
fig = px.histogram(
    data,
    x='value',
    title='Value Distribution',
    nbins=50
)

# Add threshold lines
fig.add_vline(
    x=mean_value,
    line_dash="dash",
    line_color="blue",
    annotation_text="Mean"
)
fig.add_vline(
    x=p95_value,
    line_dash="dash",
    line_color="red",
    annotation_text="P95"
)

st.plotly_chart(fig, use_container_width=True)
```

---

## Complete Page Example

### Full Implementation: User Analysis Page

```python
"""User Analysis Page - Detailed user statistics and engagement metrics"""
import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime
from utils.data_loader import (
    execute_aggregation_query,
    get_table_name,
    get_agent_filter_clause,
    get_user_type_filter_clause,
    get_selected_agent_name
)

def create_user_analysis():
    """Create the user analysis page."""

    selected_agent = get_selected_agent_name()
    st.title(f"👥 User Analysis: {selected_agent}")
    st.markdown("---")

    # Build WHERE clause
    where_parts = ['"type" = \'success\'', get_agent_filter_clause()]
    user_type_filter = get_user_type_filter_clause()
    if user_type_filter:
        where_parts.append(user_type_filter)
    where_clause = ' AND '.join(where_parts)

    # Section 1: Overview Metrics
    st.markdown("## 📊 Overview")
    overview_data = load_overview_metrics(where_clause)
    display_overview_metrics(overview_data)

    st.markdown("---")

    # Section 2: User Details
    st.markdown("## 📋 User Details")
    user_details = load_user_details(where_clause)
    display_user_table(user_details)

    st.markdown("---")

    # Section 3: Activity Timeline
    st.markdown("## 📅 Activity Timeline")
    activity_data = load_activity_timeline(where_clause)
    display_activity_chart(activity_data)

@st.cache_data(ttl=300)
def load_overview_metrics(where_clause: str) -> pd.DataFrame:
    """Load overview metrics."""
    query = f'''
        SELECT
            COUNT(DISTINCT "user_name") as total_users,
            COUNT(*) as total_events,
            AVG(total_events_per_user.event_count) as avg_events_per_user
        FROM (
            SELECT
                "user_name",
                COUNT(*) as event_count
            FROM {get_table_name()}
            WHERE {where_clause}
            GROUP BY "user_name"
        ) total_events_per_user
    '''
    return execute_aggregation_query(query)

@st.cache_data(ttl=300)
def load_user_details(where_clause: str) -> pd.DataFrame:
    """Load detailed user statistics."""
    query = f'''
        SELECT
            "user_name",
            COUNT(*) as total_events,
            COUNT(DISTINCT "project_id") as projects,
            MIN(TO_TIMESTAMP("event_date")) as first_seen,
            MAX(TO_TIMESTAMP("event_date")) as last_seen
        FROM {get_table_name()}
        WHERE {where_clause}
        GROUP BY "user_name"
        ORDER BY total_events DESC
    '''
    return execute_aggregation_query(query)

@st.cache_data(ttl=300)
def load_activity_timeline(where_clause: str) -> pd.DataFrame:
    """Load activity timeline data."""
    query = f'''
        SELECT
            DATE(TO_TIMESTAMP("event_date")) as date,
            COUNT(DISTINCT "user_name") as active_users,
            COUNT(*) as events
        FROM {get_table_name()}
        WHERE {where_clause}
            AND TO_TIMESTAMP("event_date") >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY DATE(TO_TIMESTAMP("event_date"))
        ORDER BY date
    '''
    return execute_aggregation_query(query)

def display_overview_metrics(data: pd.DataFrame):
    """Display overview metrics."""
    if data.empty:
        st.warning("No overview data available")
        return

    row = data.iloc[0]

    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Total Users", f"{int(row['total_users']):,}")

    with col2:
        st.metric("Total Events", f"{int(row['total_events']):,}")

    with col3:
        st.metric("Avg Events/User", f"{row['avg_events_per_user']:.1f}")

def display_user_table(data: pd.DataFrame):
    """Display user details table."""
    if data.empty:
        st.warning("No user data available")
        return

    # Add filters
    col1, col2 = st.columns(2)

    with col1:
        min_events = st.number_input("Min Events:", min_value=0, value=0)

    with col2:
        sort_by = st.selectbox("Sort by:", ["Total Events", "Projects", "User Name"])

    # Apply filters
    filtered = data[data['total_events'] >= min_events]

    # Apply sorting
    if sort_by == "Total Events":
        filtered = filtered.sort_values('total_events', ascending=False)
    elif sort_by == "Projects":
        filtered = filtered.sort_values('projects', ascending=False)
    else:
        filtered = filtered.sort_values('user_name')

    # Display
    st.dataframe(filtered, use_container_width=True, height=400)

def display_activity_chart(data: pd.DataFrame):
    """Display activity timeline chart."""
    if data.empty or len(data) < 2:
        st.info("Not enough data for timeline")
        return

    fig = px.line(
        data,
        x='date',
        y='active_users',
        title='Daily Active Users (Last 90 Days)',
        markers=True
    )
    st.plotly_chart(fig, use_container_width=True)
```

---

## Testing Templates

### Validation Query Template

```sql
-- Run this with mcp__keboola__query_data BEFORE writing code
-- to validate assumptions

-- 1. Check if column exists and get distinct values
SELECT DISTINCT "column_name", COUNT(*) as count
FROM "database"."schema"."table"
GROUP BY "column_name"
ORDER BY count DESC
LIMIT 20;

-- 2. Check data types and NULL percentages
SELECT
    COUNT(*) as total_rows,
    COUNT("column") as non_null_count,
    COUNT(*) - COUNT("column") as null_count,
    ROUND((COUNT(*) - COUNT("column")) * 100.0 / COUNT(*), 2) as null_pct
FROM "database"."schema"."table";

-- 3. Test filter condition
SELECT COUNT(*) as matching_rows
FROM "database"."schema"."table"
WHERE "column" = 'expected_value';

-- 4. Sample data preview
SELECT *
FROM "database"."schema"."table"
LIMIT 10;
```

### Playwright Verification Script

```python
# Step-by-step Playwright verification

# 1. Navigate to app
mcp__playwright__browser_navigate(url="http://localhost:8501")

# 2. Wait for load
mcp__playwright__browser_wait_for(time=3)

# 3. Take baseline screenshot
mcp__playwright__browser_take_screenshot(filename="page-baseline.png")

# 4. Test interaction
mcp__playwright__browser_click(element="Filter option", ref="e123")

# 5. Wait for update
mcp__playwright__browser_wait_for(time=2)

# 6. Verify result
mcp__playwright__browser_take_screenshot(filename="page-after-filter.png")

# 7. Navigate to another page
mcp__playwright__browser_click(element="Users page", ref="e456")

# 8. Wait and verify
mcp__playwright__browser_wait_for(time=2)
mcp__playwright__browser_take_screenshot(filename="users-page.png")
```

---

## Common Patterns

### Building WHERE Clauses

```python
# Pattern: Combine multiple filters safely

where_parts = []

# Always include base filter
where_parts.append('"type" = \'success\'')

# Add required filters
where_parts.append(get_agent_filter_clause())

# Add optional filters only if they return a value
user_filter = get_user_type_filter_clause()
if user_filter:
    where_parts.append(user_filter)

date_filter = get_date_filter_clause()
if date_filter:
    where_parts.append(date_filter)

category_filter = get_category_filter_clause()
if category_filter:
    where_parts.append(category_filter)

# Combine all parts
where_clause = ' AND '.join(where_parts)

# Use in query
query = f'''
    SELECT ...
    FROM {get_table_name()}
    WHERE {where_clause}
    GROUP BY ...
'''
```

### Session State Initialization

```python
# Initialize all session state at app start
def initialize_session_state():
    """Initialize all session state variables with defaults."""
    defaults = {
        'selected_agent': 'All Agents',
        'user_type_filter': 'External Users Only',
        'date_range': 'Last 90 Days',
        'selected_categories': [],
        'sort_order': 'Descending'
    }

    for key, default_value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = default_value

# Call at the start of main()
def main():
    initialize_session_state()
    # ... rest of app
```

### Error Boundary Pattern

```python
def safe_section(section_func, section_name: str):
    """
    Execute section with error handling.

    Args:
        section_func: Function to execute
        section_name: Name for error messages
    """
    try:
        section_func()
    except Exception as e:
        st.error(f"Error in {section_name}: {str(e)}")
        with st.expander("Error Details"):
            import traceback
            st.code(traceback.format_exc())

# Usage
def create_page():
    safe_section(create_overview_section, "Overview")
    safe_section(create_trends_section, "Trends")
    safe_section(create_details_section, "Details")
```

---

## Quick Reference: Common Snippets

### Format Number with Commas
```python
st.metric("Users", f"{count:,}")  # 1234567 → 1,234,567
```

### Format Percentage
```python
st.metric("Success Rate", f"{rate:.2f}%")  # 0.9567 → 95.67%
```

### Format Currency
```python
st.metric("Total Cost", f"${amount:.2f}")  # 1234.567 → $1234.57
```

### Format Date
```python
date_str = pd.to_datetime(date_val).strftime('%Y-%m-%d')  # 2025-11-19
```

### Conditional Emoji
```python
emoji = "✅" if value >= threshold else "⚠️" if value >= warning else "🔴"
st.metric("Status", f"{value:.1f}% {emoji}")
```

### Safe Column Access
```python
if 'column_name' in df.columns:
    value = df['column_name'].iloc[0]
else:
    st.warning("Expected column not found")
    value = None
```

---

Use these templates as starting points and adapt them to your specific needs!
