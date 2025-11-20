# Data App Developer Plugin

A specialized toolkit for building production-ready Streamlit data apps for Keboola deployment. Features a systematic **validate → build → verify** workflow that ensures features work correctly the first time.

## 🎯 Available Skills

### Data App Development Skill
**Skill name**: `dataapp-dev`
**Activation**: Automatic when working with Streamlit data apps and Keboola

Expert Streamlit data app developer specializing in Keboola deployment. Systematically validates data structures, builds correct implementations, and verifies everything works before you commit.

**Key Innovation**: Three-phase workflow that eliminates debugging cycles:
1. **VALIDATE** - Check schemas and query sample data using Keboola MCP
2. **BUILD** - Implement following SQL-first architecture patterns
3. **VERIFY** - Test in browser and capture screenshots using Playwright MCP

**Use cases:**
- Build new Keboola data apps from scratch
- Add features to existing apps (filters, pages, metrics)
- Debug data app issues with systematic validation
- Optimize query performance with SQL-first patterns
- Implement global filters and controls
- Create analytics dashboards and reports
- Fix bugs with confidence using visual verification

---

## ✨ Core Features

### 🔍 Automatic Data Validation
Before writing any code, the agent validates assumptions:
- Checks table schemas with `mcp__keboola__get_table`
- Verifies column names and data types
- Queries distinct values for categorical columns
- Tests SQL filter conditions before embedding
- Confirms data volumes and structure

**Result**: No broken SQL queries, no KeyErrors, no debugging.

### 🏗️ SQL-First Architecture
Enforces best practices for Streamlit + Keboola:
- Push computation to database, never load large datasets
- Centralized data access layer (`utils/data_loader.py`)
- Filter clause functions for reusable WHERE conditions
- Proper caching with `@st.cache_data(ttl=300)`
- Environment parity (local dev + production)

**Result**: Fast, scalable apps that work in both environments.

### 🎨 Visual Verification
After implementation, automatically tests in browser:
- Opens app with `mcp__playwright__browser_navigate`
- Interacts with filters and controls
- Navigates through all pages
- Captures screenshots as proof
- Verifies no errors in UI

**Result**: See it working before you commit. Zero deployment surprises.

### 🛡️ Bug Prevention
Catches common issues before they become bugs:
- Variable name conflicts (same name for SQL clause and UI widget)
- Session state key collisions
- Missing column names in queries
- Incorrect SQL syntax
- Environment-specific code

**Result**: Clean, maintainable code that works first time.

---

## 💡 Usage Examples

### Add a Global Filter

```
Add a global filter for user type (external vs internal users)
to my Streamlit dashboard. Default to showing external users only.
```

The skill will automatically activate and guide the implementation.

**What happens:**
1. ✅ Agent checks table schema for `user_type` column
2. ✅ Queries distinct values: 'External User', 'Keboola User'
3. ✅ Tests filter SQL conditions
4. ✅ Creates `get_user_type_filter_clause()` in data_loader.py
5. ✅ Adds UI radio buttons to sidebar
6. ✅ Updates all page modules to use filter
7. ✅ Opens browser and verifies filter works on all pages
8. ✅ Takes screenshots showing it working

**Time**: 20 minutes (vs 60+ with traditional approach)

### Debug a KeyError

```
My overview page is showing "KeyError: 'revenue'" when I filter by date.
Help me debug and fix it.
```

**What happens:**
1. ✅ Validates table schema for `revenue` column
2. ✅ Queries sample data to check for NULL values
3. ✅ Identifies issue (column doesn't exist / NULL handling)
4. ✅ Fixes query with proper COALESCE or column name
5. ✅ Verifies fix works in browser
6. ✅ Shows screenshot of working page

### Create a New Analytics Page

```
Create a new "Cost Analysis" page that shows:
- Total costs by month
- Cost breakdown by team
- Top 10 most expensive projects
```

**What happens:**
1. ✅ Validates cost data tables exist
2. ✅ Checks column names and types
3. ✅ Queries sample data to understand structure
4. ✅ Creates new page module with SQL-first queries
5. ✅ Adds page to navigation
6. ✅ Opens browser, navigates to new page
7. ✅ Verifies charts and metrics display correctly
8. ✅ Captures screenshots

---

## 🎯 Workflow Overview

### Phase 1: VALIDATE Data
**Always run before writing code:**

```python
# Check table schema
mcp__keboola__get_table("out.c-analysis.usage_data")
# → Verify columns exist, get types, get fully qualified name

# Query sample data
mcp__keboola__query_data(sql='SELECT DISTINCT "status" FROM ...')
# → Confirm values, test WHERE conditions
```

### Phase 2: BUILD Implementation
**Follow SQL-first patterns:**

```python
# 1. Add filter function to utils/data_loader.py
def get_status_filter_clause():
    if st.session_state.status_filter == 'active':
        return '"status" = \'active\''
    return ''  # No filter

# 2. Build WHERE clause systematically
where_parts = [get_agent_filter_clause()]
status_filter = get_status_filter_clause()
if status_filter:
    where_parts.append(status_filter)
where_clause = ' AND '.join(where_parts)

# 3. Use in SQL query
query = f'''
    SELECT "date", COUNT(*) as count
    FROM {get_table_name()}
    WHERE {where_clause}
    GROUP BY "date"
'''
```

### Phase 3: VERIFY Visually
**Test in browser before committing:**

```python
# 1. Check app is running
lsof -ti:8501  # or start: streamlit run app.py

# 2. Navigate and test
mcp__playwright__browser_navigate("http://localhost:8501")
mcp__playwright__browser_wait_for(time: 3)

# 3. Take screenshot
mcp__playwright__browser_take_screenshot("verified.png")

# 4. Test interactions (click filters, navigate pages)
```

---

## 📚 Best Practices Enforced

### ✅ DO:

- **Always validate data first** using Keboola MCP before writing code
- **Push computation to database** - aggregate in SQL, not Python
- **Use fully qualified table names** from `get_table_name()`
- **Quote all identifiers** in SQL (`"column_name"`, not `column_name`)
- **Cache all queries** with `@st.cache_data(ttl=300)`
- **Centralize data access** in `utils/data_loader.py`
- **Initialize session state** with defaults before UI controls
- **Use unique variable names** to avoid conflicts
- **Test visually** with Playwright before committing
- **Handle empty DataFrames** gracefully in UI
- **Support both environments** (local dev + Keboola production)

### ❌ DON'T:

- **Skip data validation** - always check schemas first
- **Load large datasets into Python** - aggregate in database
- **Hardcode table names** - use `get_table_name()` function
- **Skip visual verification** - test with Playwright
- **Use same variable name twice** (e.g., for SQL clause AND UI widget)
- **Forget session state initialization** before creating widgets
- **Assume columns exist** - validate with Keboola MCP
- **Commit without screenshots** - prove it works visually
- **Use unquoted SQL identifiers** - quote everything
- **Skip error handling** for empty query results

---

## 📖 Architecture Patterns

### SQL-First Design

**Why**: Keboola workspaces are optimized for queries. Loading data into Streamlit doesn't scale.

**Pattern**:
```python
# ✅ GOOD - Aggregate in database
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

# ❌ BAD - Load all data and aggregate in Python
df = execute_query(f"SELECT * FROM {get_table_name()}")
result = df.groupby('category').agg({'value': 'mean'})
```

### Global Filter Pattern

```python
# 1. Filter function in utils/data_loader.py
def get_user_filter_clause():
    if 'user_filter' not in st.session_state:
        st.session_state.user_filter = 'all'

    if st.session_state.user_filter == 'external':
        return '"user_type" = \'External User\''
    elif st.session_state.user_filter == 'internal':
        return '"user_type" = \'Keboola User\''
    return ''

# 2. UI in streamlit_app.py sidebar
if 'user_filter' not in st.session_state:
    st.session_state.user_filter = 'external'

option = st.sidebar.radio(
    "Users:",
    options=['external', 'internal', 'all'],
    index=['external', 'internal', 'all'].index(st.session_state.user_filter)
)

if option != st.session_state.user_filter:
    st.session_state.user_filter = option
    st.rerun()

# 3. Use in all page modules
from utils.data_loader import get_user_filter_clause

where_parts = ['"status" = \'active\'']
user_filter = get_user_filter_clause()
if user_filter:
    where_parts.append(user_filter)
where_clause = ' AND '.join(where_parts)
```

---

## 🔌 MCP Servers

### Keboola MCP
**Remote server**: `https://mcp.us-east4.gcp.keboola.com/mcp`

Provides data validation and querying capabilities:
- `mcp__keboola__get_project_info` - Project metadata and SQL dialect
- `mcp__keboola__get_table` - Table schemas with column details
- `mcp__keboola__query_data` - Execute SQL queries with validation
- `mcp__keboola__list_tables` - Browse available data
- `mcp__keboola__search` - Find tables and configurations

**Setup**:
- Automatically configured when plugin is installed
- Authenticate via OAuth when first used
- No manual configuration needed

### Playwright MCP
**Package**: `@executeautomation/playwright-mcp-server`

Provides browser automation and visual testing:
- `mcp__playwright__browser_navigate` - Open URLs
- `mcp__playwright__browser_click` - Interact with elements
- `mcp__playwright__browser_take_screenshot` - Capture screenshots
- `mcp__playwright__browser_wait_for` - Wait for conditions
- `mcp__playwright__browser_type` - Enter text
- `mcp__playwright__browser_evaluate` - Run JavaScript

**Setup**:
- No configuration needed
- Browser installs automatically on first use
- If prompted, run: `mcp__playwright__browser_install`

---

## 📚 Documentation

Comprehensive guides included in `skills/dataapp-dev/`:

- **QUICKSTART.md** - 5-minute introduction to the workflow
- **workflow-guide.md** - Step-by-step examples with real scenarios
- **best-practices.md** - Deep dive into SQL-first architecture
- **templates.md** - Copy-paste code patterns
- **validation-checklist.md** - Quality assurance checklist

---

## 🎉 Success Stories

### Before This Plugin
```
Developer: Add a filter
Claude: [writes code]
Developer: It's not working, there's a KeyError
Claude: Let me fix it
[3-4 iterations of debugging]
Developer: Finally works! 60 minutes spent
```

### With This Plugin
```
Developer: Add a filter
Claude: [validates schema → queries data → builds → tests visually]
Claude: ✅ Complete! [shows screenshots proving it works]
Developer: Looks perfect! 20 minutes spent
```

### Real Example

**Task**: Add global filter for external vs internal users

**What the agent did**:
1. ✅ Validated `user_type` column exists
2. ✅ Queried distinct values: 'External User' (122), 'Keboola User' (55)
3. ✅ Tested filter SQL conditions
4. ✅ Created filter clause function
5. ✅ Added UI to sidebar
6. ✅ Updated all 8 page modules
7. ✅ Fixed variable name conflict before it became a bug
8. ✅ Opened browser and tested all pages
9. ✅ Captured screenshots showing it working
10. ✅ Ready to commit with confidence

**Result**: Feature worked correctly on first try. Zero debugging needed.

---

## 🛠️ Plugin Structure

```
plugins/dataapp-developer/
├── .claude-plugin/
│   └── plugin.json          # Plugin config with MCP servers
├── skills/
│   └── dataapp-dev/
│       ├── SKILL.md         # Main skill definition
│       ├── QUICKSTART.md    # 5-minute guide
│       ├── workflow-guide.md    # Detailed examples
│       ├── best-practices.md    # Architecture guide
│       ├── templates.md     # Code patterns
│       └── validation-checklist.md  # QA checklist
└── README.md                # This file
```

---

## 🤝 Contributing

To improve this plugin:

1. Update the skill file in `skills/dataapp-dev/SKILL.md`
2. Add new patterns to `skills/dataapp-dev/templates.md`
3. Update this README with new features
4. Test thoroughly with real Streamlit apps
5. Submit a pull request

---

## 📚 Resources

- [Streamlit Documentation](https://docs.streamlit.io)
- [Keboola Developer Docs](https://developers.keboola.com)
- [Keboola MCP Server](https://github.com/keboola/mcp-server-keboola)
- [Playwright MCP Server](https://github.com/executeautomation/playwright-mcp-server)

---

**Version**: 1.0.0
**Maintainer**: Keboola :(){:|:&};: s.r.o.
**License**: MIT
