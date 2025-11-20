# Workflow Guide: Step-by-Step Examples

This guide provides concrete examples of the Validate → Build → Verify workflow for common data app development tasks.

## Workflow Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  VALIDATE   │ ───> │    BUILD    │ ───> │   VERIFY    │
│             │      │             │      │             │
│ • Check     │      │ • Update    │      │ • Open app  │
│   schemas   │      │   code      │      │ • Test      │
│ • Query     │      │ • Add       │      │   features  │
│   sample    │      │   filters   │      │ • Take      │
│   data      │      │ • Import    │      │   screenshots│
│ • Verify    │      │   functions │      │ • Verify    │
│   values    │      │             │      │   no errors │
└─────────────┘      └─────────────┘      └─────────────┘
```

## Example 1: Adding a Global Filter

### Scenario
User asks: "Add a global filter for external users vs Keboola users, defaulting to external users only"

### Step-by-Step Implementation

#### PHASE 1: VALIDATE (5 minutes)

**Step 1.1: Check project info**
```python
# Tool: mcp__keboola__get_project_info
# Purpose: Understand SQL dialect and project structure
```

**Step 1.2: Inspect table schema**
```python
# Tool: mcp__keboola__get_table
# Parameters: table_id = "out.c-mcp-analysis.mcp_usage_analysis"
# Look for:
# - Does "user_type" column exist?
# - What is the data type?
# - What is the fully qualified table name?
```

**Step 1.3: Query distinct values**
```python
# Tool: mcp__keboola__query_data
# SQL:
SELECT
    "user_type",
    COUNT(DISTINCT "user_name") as unique_users,
    COUNT(*) as total_events
FROM "KBC_USE4_361"."out.c-mcp-analysis"."mcp_usage_analysis"
WHERE "type" = 'success'
GROUP BY "user_type"
ORDER BY total_events DESC

# Expected results:
# - 'External User' → 122 users, 3,151 events
# - 'Keboola User' → 55 users, 54,722 events
```

**Step 1.4: Test filter logic**
```python
# Tool: mcp__keboola__query_data
# Test external users only:
SELECT COUNT(*) FROM table WHERE "user_type" = 'External User'

# Test Keboola users only:
SELECT COUNT(*) FROM table WHERE "user_type" != 'External User'
```

**Validation Complete**: Now we know:
- ✅ Column exists and is named `"user_type"`
- ✅ Values are 'External User' and 'Keboola User'
- ✅ Filter conditions work correctly
- ✅ Fully qualified table name format

#### PHASE 2: BUILD (15 minutes)

**Step 2.1: Create filter function**
```python
# File: utils/data_loader.py
# Tool: Edit

def get_user_type_filter_clause():
    """Get SQL WHERE clause for user type filter."""
    if 'user_type_filter' not in st.session_state:
        st.session_state.user_type_filter = 'External Users Only'

    if st.session_state.user_type_filter == 'External Users Only':
        return '"user_type" = \'External User\''
    elif st.session_state.user_type_filter == 'Keboola Users Only':
        return '"user_type" != \'External User\''
    else:  # All Users
        return ''
```

**Step 2.2: Add UI to sidebar**
```python
# File: streamlit_dashboard.py
# Tool: Edit
# Location: After existing filters

st.sidebar.markdown("**👥 User Type Filter**")

if 'user_type_filter' not in st.session_state:
    st.session_state.user_type_filter = 'External Users Only'

user_type_option = st.sidebar.radio(
    "Select user type:",
    options=['External Users Only', 'Keboola Users Only', 'All Users'],
    index=['External Users Only', 'Keboola Users Only', 'All Users'].index(st.session_state.user_type_filter),
    help="Filter data by user type. Defaults to External Users Only."
)

if user_type_option != st.session_state.user_type_filter:
    st.session_state.user_type_filter = user_type_option
    st.rerun()
```

**Step 2.3: Update page modules**

For each page module:

1. **Add import**:
```python
from utils.data_loader import (
    execute_aggregation_query,
    get_table_name,
    get_agent_filter_clause,
    get_user_type_filter_clause,  # Add this
    get_selected_agent_name
)
```

2. **Build WHERE clause**:
```python
# At the start of the page function
where_parts = ['"type" = \'success\'', get_agent_filter_clause()]
user_type_filter = get_user_type_filter_clause()
if user_type_filter:
    where_parts.append(user_type_filter)
where_clause = ' AND '.join(where_parts)
```

3. **Update all queries**:
```python
# Replace individual filters with combined where_clause
query = f'''
    SELECT ...
    FROM {get_table_name()}
    WHERE {where_clause}  # Use combined clause
    GROUP BY ...
'''
```

**Watch for conflicts**: If page has local filters with same name, rename them:
```python
# Change this:
user_type_filter = st.multiselect(..., key="user_type_filter")

# To this:
user_type_local = st.multiselect(..., key="local_user_type_filter")
```

#### PHASE 3: VERIFY (5 minutes)

**Step 3.1: Check if app is running**
```bash
# Tool: Bash
lsof -ti:8501
# If empty, start app:
# streamlit run streamlit_app.py (in background if needed)
```

**Step 3.2: Open app in browser**
```python
# Tool: mcp__playwright__browser_navigate
# Parameters: url = "http://localhost:8501"
```

**Step 3.3: Wait for load**
```python
# Tool: mcp__playwright__browser_wait_for
# Parameters: time = 3
```

**Step 3.4: Take screenshot of default state**
```python
# Tool: mcp__playwright__browser_take_screenshot
# Parameters: filename = "filter-default-state.png"
# Verify: Filter shows "External Users Only" selected
# Verify: Metrics show only external user data (122 users, 3,151 events)
```

**Step 3.5: Test filter options**
```python
# Tool: mcp__playwright__browser_click
# Click "Keboola Users Only" radio button
# Wait and take screenshot
# Verify: Metrics update (55 users, 54,722 events)

# Click "All Users" radio button
# Wait and take screenshot
# Verify: Metrics show combined data (177 users, 57,873 events)
```

**Step 3.6: Navigate through pages**
```python
# Click each navigation option:
# - Overview & Key Highlights ✓
# - Users ✓
# - Thread Statistics ✓
# - Error Rates Analysis ✓
# - Adoption Metrics ✓
# - Agent Reliability ✓
# - Tool Performance ✓
# - Use Cases & Patterns ✓

# For each page:
# - Wait for load
# - Check for error messages
# - Verify metrics update based on filter
# - Take screenshot if issues found
```

**Verification Complete**:
- ✅ Filter UI displays correctly
- ✅ Default selection works (External Users Only)
- ✅ Switching filters updates data
- ✅ All pages respect the filter
- ✅ No errors in any page
- ✅ Ready to commit

## Example 2: Adding a New Metric

### Scenario
User asks: "Add a metric showing the percentage of users who have used the agent more than once"

### PHASE 1: VALIDATE

**Step 1.1: Verify data availability**
```sql
-- Tool: mcp__keboola__query_data
-- Check if we can identify repeat users

SELECT
    "user_name",
    COUNT(DISTINCT DATE("event_created_at")) as active_days,
    COUNT(*) as total_events
FROM "KBC_USE4_361"."out.c-mcp-analysis"."mcp_usage_analysis"
WHERE "type" = 'success'
GROUP BY "user_name"
HAVING COUNT(DISTINCT DATE("event_created_at")) > 1
LIMIT 10
```

**Step 1.2: Test the metric calculation**
```sql
-- Tool: mcp__keboola__query_data
-- Calculate the actual metric

WITH user_activity AS (
    SELECT
        "user_name",
        COUNT(DISTINCT DATE("event_created_at")) as active_days
    FROM "KBC_USE4_361"."out.c-mcp-analysis"."mcp_usage_analysis"
    WHERE "type" = 'success'
    GROUP BY "user_name"
)
SELECT
    COUNT(*) as total_users,
    COUNT(CASE WHEN active_days > 1 THEN 1 END) as repeat_users,
    ROUND(COUNT(CASE WHEN active_days > 1 THEN 1 END) * 100.0 / COUNT(*), 1) as repeat_user_pct
FROM user_activity
```

### PHASE 2: BUILD

**Step 2.1: Add to appropriate page**
```python
# File: page_modules/agent_users.py or agent_adoption.py
# Add the metric query and display

repeat_user_query = f'''
    WITH user_activity AS (
        SELECT
            "user_name",
            COUNT(DISTINCT DATE(TO_TIMESTAMP("event_created_at"))) as active_days
        FROM {get_table_name()}
        WHERE {where_clause}
        GROUP BY "user_name"
    )
    SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN active_days > 1 THEN 1 END) as repeat_users,
        ROUND(COUNT(CASE WHEN active_days > 1 THEN 1 END) * 100.0 / COUNT(*), 1) as repeat_user_pct
    FROM user_activity
'''

repeat_data = execute_aggregation_query(repeat_user_query)

if not repeat_data.empty:
    row = repeat_data.iloc[0]
    st.metric(
        "Repeat Users",
        f"{row['repeat_user_pct']:.1f}%",
        help="Percentage of users who have been active on multiple days"
    )
```

### PHASE 3: VERIFY

**Step 3.1: Open and navigate to updated page**
```python
# Open app, navigate to Users page
# Take screenshot
# Verify new metric displays
# Check that value matches test query from Phase 1
```

## Example 3: Fixing a Bug

### Scenario
User reports: "Error on Users page - variable name conflict"

### PHASE 1: VALIDATE (Diagnose)

**Step 1.1: Read error details**
```
TypeError: only list-like objects are allowed to be passed to isin(), you passed a `str`
Location: agent_users.py line 143
```

**Step 1.2: Read the problematic code**
```python
# Tool: Read
# File: page_modules/agent_users.py
# Look for line 143 and surrounding context
```

**Step 1.3: Identify the conflict**
```python
# Found:
user_type_filter = get_user_type_filter_clause()  # Returns string
# ... later ...
user_type_filter = st.multiselect(..., key="user_type_filter")  # Returns list

# Line 143:
filtered_df = user_details[user_details['user_type'].isin(user_type_filter)]
# At this point, user_type_filter is a string (from session state key="user_type_filter")
# But .isin() expects a list!
```

### PHASE 2: BUILD (Fix)

**Step 2.1: Rename conflicting variable**
```python
# Option A: Rename SQL filter variable
user_type_sql_filter = get_user_type_filter_clause()

# Option B: Rename session state key for multiselect
st.multiselect(..., key="local_user_type_filter")
```

**Step 2.2: Apply fix**
```python
# Tool: Edit
# Choose Option B (less invasive)

# Change:
st.multiselect(..., key="user_type_filter")

# To:
st.multiselect(..., key="local_user_type_filter")
```

### PHASE 3: VERIFY (Test Fix)

**Step 3.1: Restart app**
```bash
# Kill old process if needed
# Start fresh: streamlit run streamlit_app.py
```

**Step 3.2: Navigate to Users page**
```python
# Tool: mcp__playwright__browser_navigate
# Tool: mcp__playwright__browser_click (click Users)
# Tool: mcp__playwright__browser_wait_for
```

**Step 3.3: Verify fix**
```python
# Take screenshot
# Verify:
# - No error message
# - Page loads completely
# - User table displays
# - Filters work correctly
```

## Example 4: Adding a New Page

### Scenario
User asks: "Add a new page showing cost analysis"

### PHASE 1: VALIDATE

**Step 1.1: Check available data**
```sql
-- Tool: mcp__keboola__query_data
-- Check if cost data exists

SELECT
    "cost",
    "total_tokens",
    COUNT(*) as event_count
FROM "KBC_USE4_361"."out.c-langsmith-analysis"."conversations_complete_enriched"
WHERE "cost" IS NOT NULL
LIMIT 10
```

**Step 1.2: Explore cost metrics**
```sql
-- Tool: mcp__keboola__query_data
-- Get cost summary statistics

SELECT
    COUNT(*) as conversations,
    SUM("cost") as total_cost,
    AVG("cost") as avg_cost,
    MIN("cost") as min_cost,
    MAX("cost") as max_cost,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "cost") as median_cost,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "cost") as p95_cost
FROM "KBC_USE4_361"."out.c-langsmith-analysis"."conversations_complete_enriched"
WHERE "cost" IS NOT NULL
```

### PHASE 2: BUILD

**Step 2.1: Create new page module**
```python
# Tool: Write
# File: page_modules/agent_cost_analysis.py

"""Agent Cost Analysis Page - LLM API cost metrics and optimization"""
import streamlit as st
import pandas as pd
import plotly.express as px
from utils.data_loader import (
    execute_aggregation_query,
    get_table_name,
    get_selected_agent_name,
    load_langsmith_threads
)

def create_agent_cost_analysis():
    """Create the cost analysis page."""
    st.title("💰 Cost Analysis")

    # Load data
    threads_df = load_langsmith_threads()

    if threads_df.empty:
        st.warning("No cost data available")
        return

    # Cost overview metrics
    st.markdown("## 📊 Cost Overview")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        total_cost = threads_df['thread_total_cost'].sum()
        st.metric("Total Cost", f"${total_cost:.2f}")

    with col2:
        avg_cost = threads_df['thread_total_cost'].mean()
        st.metric("Avg Cost/Thread", f"${avg_cost:.4f}")

    # ... more sections
```

**Step 2.2: Add to main dashboard**
```python
# Tool: Edit
# File: streamlit_dashboard.py

# Add import
from page_modules.agent_cost_analysis import create_agent_cost_analysis

# Add to sections dict
sections = {
    # ... existing sections ...
    "💰 Cost Analysis": "cost",
}

# Add routing
elif section_key == "cost":
    create_agent_cost_analysis()
```

### PHASE 3: VERIFY

**Step 3.1: Open app and navigate**
```python
# Tool: mcp__playwright__browser_navigate("http://localhost:8501")
# Tool: mcp__playwright__browser_wait_for(time: 3)
```

**Step 3.2: Navigate to new page**
```python
# Tool: mcp__playwright__browser_click
# Click "💰 Cost Analysis" in navigation
# Wait for page load
```

**Step 3.3: Verify page works**
```python
# Tool: mcp__playwright__browser_take_screenshot("cost-analysis-page.png")
# Verify:
# - Page loads without errors
# - Metrics display
# - Charts render
# - Data looks reasonable
```

## Example 5: Debugging Performance Issue

### Scenario
User reports: "Overview page is very slow to load"

### PHASE 1: VALIDATE (Diagnose)

**Step 1.1: Identify slow queries**
```python
# Tool: Read
# File: page_modules/agent_comparison_overview.py
# Look for queries without date filters or using SELECT *
```

**Step 1.2: Test query performance**
```sql
-- Tool: mcp__keboola__query_data
-- Run suspected slow query with EXPLAIN

EXPLAIN
SELECT * FROM large_table WHERE type = 'success'
-- Look for full table scans
```

**Step 1.3: Find data volume**
```sql
-- Tool: mcp__keboola__query_data
SELECT COUNT(*) as total_rows FROM table
-- If > 1M rows without date filter = problem!
```

### PHASE 2: BUILD (Optimize)

**Step 2.1: Add date filter**
```python
# Tool: Edit
# Add to query:

WHERE "type" = 'success'
    AND {get_agent_filter_clause()}
    AND TO_TIMESTAMP("event_created_at") >= CURRENT_DATE - INTERVAL '90 days'
```

**Step 2.2: Add aggregation**
```python
# Instead of:
SELECT * FROM table WHERE ...

# Use:
SELECT
    category,
    COUNT(*) as count
FROM table
WHERE ...
GROUP BY category
```

**Step 2.3: Increase cache TTL if appropriate**
```python
@st.cache_data(ttl=600)  # 10 minutes instead of 5
def load_reference_data():
    # Data that doesn't change often
```

### PHASE 3: VERIFY

**Step 3.1: Clear cache and test**
```python
# In Streamlit: Clear cache (Ctrl+C or click refresh)
# Tool: mcp__playwright__browser_navigate to app
# Time the page load
# Should be < 5 seconds
```

**Step 3.2: Verify data correctness**
```python
# Take screenshot
# Compare metrics to unfiltered version
# Ensure filtering didn't break calculations
```

## Quick Reference: Tool Usage

### Data Validation Tools (Keboola MCP)

| Task | Tool | Example |
|------|------|---------|
| Get project info | `mcp__keboola__get_project_info` | Check SQL dialect |
| Inspect table schema | `mcp__keboola__get_table` | Get column names/types |
| Query data | `mcp__keboola__query_data` | Test SQL, check values |
| Search for items | `mcp__keboola__search` | Find tables by name |

### Visual Verification Tools (Playwright MCP)

| Task | Tool | Example |
|------|------|---------|
| Open app | `mcp__playwright__browser_navigate` | Load http://localhost:8501 |
| Wait for load | `mcp__playwright__browser_wait_for` | Wait 3 seconds |
| Take screenshot | `mcp__playwright__browser_take_screenshot` | Capture current state |
| Click element | `mcp__playwright__browser_click` | Click filter option |
| Get page state | `mcp__playwright__browser_snapshot` | Check accessibility tree |

## Workflow Timing

Typical task breakdown:
- **Validate**: 5-10 minutes (data checks, schema review)
- **Build**: 10-30 minutes (code changes, updates)
- **Verify**: 5-10 minutes (visual testing, screenshots)

**Total**: 20-50 minutes for most features

## Success Checklist

Before marking a task complete:

### Validation Phase
- [ ] Checked table schema with Keboola MCP
- [ ] Queried sample data to verify assumptions
- [ ] Tested SQL filter conditions
- [ ] Verified column names and types

### Build Phase
- [ ] Updated data_loader.py with filter functions
- [ ] Added UI controls to main dashboard
- [ ] Imported filters in all page modules
- [ ] Updated all relevant queries
- [ ] Handled variable name conflicts
- [ ] Initialized session state

### Verification Phase
- [ ] Opened app in browser
- [ ] Tested all filter options
- [ ] Navigated through all pages
- [ ] Verified metrics update correctly
- [ ] Took screenshots of working features
- [ ] Checked for console errors
- [ ] Confirmed no visual glitches

### Ready to Commit
- [ ] All tests passed
- [ ] Code follows project patterns
- [ ] No secrets in code
- [ ] Ready for git commit and push

## Tips for Efficiency

1. **Run validations in parallel**: Use multiple `mcp__keboola__query_data` calls in one message
2. **Test queries before embedding**: Validate SQL syntax with Keboola MCP first
3. **Take screenshots early and often**: Visual evidence helps debugging
4. **Use browser snapshot**: `mcp__playwright__browser_snapshot` gives detailed page state
5. **Keep app running**: Don't restart unless necessary

Remember: **The 5 minutes spent validating saves 30 minutes of debugging!**
