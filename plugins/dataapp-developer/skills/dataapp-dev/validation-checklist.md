# Validation Checklist for Keboola Data Apps

Use this checklist to ensure quality before committing changes to production.

## 🔍 Pre-Development Validation

Before writing any code, validate these items using Keboola MCP:

### Data Structure Validation

- [ ] **Table exists**: Used `mcp__keboola__get_table` to verify table ID
- [ ] **Schema reviewed**: Checked all column names (exact case)
- [ ] **Data types confirmed**: Verified database_native_type and keboola_base_type
- [ ] **Fully qualified name**: Got complete table name for queries
- [ ] **Sample data queried**: Used `mcp__keboola__query_data` to see actual values

### Column Validation

- [ ] **Column exists**: Confirmed required columns are in schema
- [ ] **Names are correct**: Verified exact spelling and case (e.g., "user_name" not "username")
- [ ] **Types are compatible**: Checked data types support intended operations
- [ ] **NULL handling**: Checked if columns can be NULL and handled appropriately
- [ ] **Value ranges**: Queried distinct values for categorical columns

### Filter Logic Validation

- [ ] **Filter tested**: Ran test query with filter condition
- [ ] **Results expected**: Verified filter returns correct row count
- [ ] **Edge cases checked**: Tested empty results, NULL values, special characters
- [ ] **SQL syntax validated**: Confirmed query works before embedding in code

### Example Validation Queries

```sql
-- 1. Check column exists and get distinct values
SELECT DISTINCT "column_name", COUNT(*) as count
FROM "database"."schema"."table"
GROUP BY "column_name"
ORDER BY count DESC;

-- 2. Test filter condition
SELECT COUNT(*) as filtered_count
FROM "database"."schema"."table"
WHERE "column_name" = 'filter_value';

-- 3. Verify data types
SELECT
    "column1",
    "column2",
    TYPEOF("column1") as col1_type,
    TYPEOF("column2") as col2_type
FROM "database"."schema"."table"
LIMIT 5;

-- 4. Check for NULLs
SELECT
    COUNT(*) as total,
    COUNT("column") as non_null,
    COUNT(*) - COUNT("column") as nulls
FROM "database"."schema"."table";
```

## 💻 Development Validation

During implementation, verify these items:

### Code Quality

- [ ] **Follows SQL-first**: Aggregation in database, not Python
- [ ] **Environment agnostic**: Uses `os.environ.get() or st.secrets.get()`
- [ ] **Proper caching**: All queries use `@st.cache_data(ttl=300)`
- [ ] **Error handling**: Try-except blocks for all data loads
- [ ] **Type hints used**: Functions have parameter and return types
- [ ] **Docstrings present**: All functions documented

### Session State

- [ ] **Initialized properly**: All session state variables have defaults
- [ ] **Unique keys**: No key conflicts between global and local state
- [ ] **Variable names unique**: No reuse of names in same scope
- [ ] **State updates trigger rerun**: Changes to session state call `st.rerun()`

### Query Construction

- [ ] **WHERE clauses combined**: Used `' AND '.join(where_parts)` pattern
- [ ] **Quoted identifiers**: All column names in double quotes
- [ ] **Fully qualified tables**: Used `get_table_name()` function
- [ ] **Date filters added**: Time-series queries have date range limits
- [ ] **NULL safe**: Used `IS NOT NULL`, `COALESCE`, or `NULLIF` where needed

### Import Consistency

- [ ] **All page modules updated**: New filters imported in every page
- [ ] **Import order consistent**: Alphabetical or logical grouping
- [ ] **No unused imports**: Removed imports for deleted code
- [ ] **All functions available**: Imported everything needed

### Variable Naming

- [ ] **No conflicts**: SQL filter variables don't clash with UI widget variables
- [ ] **Descriptive names**: `user_type_sql_filter` vs `user_type_multiselect`
- [ ] **Consistent conventions**: snake_case for Python, UPPER for SQL
- [ ] **Keys are unique**: Widget keys like `"local_category_filter"` don't conflict with global filters

## 🎨 Visual Validation

After implementation, verify using Playwright MCP:

### App Startup

- [ ] **App running**: Verified with `lsof -ti:8501`
- [ ] **Port accessible**: Can navigate to `http://localhost:8501`
- [ ] **No startup errors**: App loads without console errors

### UI Verification

- [ ] **Filter displays**: New filter appears in sidebar
- [ ] **Default selected**: Correct default option is selected
- [ ] **Position correct**: Filter placed in logical location
- [ ] **Help text clear**: Tooltip explains what filter does
- [ ] **Layout preserved**: Existing UI not broken

### Interaction Testing

- [ ] **Filter changes data**: Switching filter updates metrics
- [ ] **All options work**: Tested each filter option
- [ ] **Page navigation works**: All pages accessible
- [ ] **No errors displayed**: No red error messages in UI
- [ ] **No console errors**: Browser console clean

### Cross-Page Validation

For each page affected by changes:

- [ ] **Page loads**: No errors on page load
- [ ] **Metrics display**: Numbers show and make sense
- [ ] **Charts render**: All visualizations appear
- [ ] **Filters apply**: Data changes when filter changes
- [ ] **Local filters work**: Page-specific filters still functional
- [ ] **Downloads work**: CSV export buttons functional (if applicable)

### Screenshot Documentation

- [ ] **Default state**: Screenshot of filter in default state
- [ ] **Alternative states**: Screenshots of other filter options
- [ ] **Each major page**: Screenshot of affected pages working
- [ ] **Error cases**: Screenshot if you found and fixed issues
- [ ] **Saved in project**: Screenshots saved for future reference

### Example Playwright Verification Sequence

```python
# 1. Open app
mcp__playwright__browser_navigate("http://localhost:8501")
mcp__playwright__browser_wait_for(time=3)

# 2. Baseline screenshot
mcp__playwright__browser_take_screenshot("baseline.png")

# 3. Test default state
# Verify filter shows correct default
# Verify metrics match expected values

# 4. Change filter
mcp__playwright__browser_click("Filter option 2")
mcp__playwright__browser_wait_for(time=2)
mcp__playwright__browser_take_screenshot("filter-option2.png")

# 5. Verify data changed
# Compare metrics to baseline
# Confirm filter is working

# 6. Test each page
for page in ["Users", "Errors", "Adoption", "Reliability", "Tools", "Use Cases"]:
    mcp__playwright__browser_click(f"{page} navigation")
    mcp__playwright__browser_wait_for(time=2)
    # Check for errors
    mcp__playwright__browser_take_screenshot(f"{page.lower()}-page.png")

# 7. Final verification
# All pages loaded successfully
# No errors anywhere
# Ready to commit
```

## 📋 Pre-Commit Checklist

Before committing changes:

### Code Review

- [ ] **Followed patterns**: Code matches existing style
- [ ] **No hardcoded values**: All config from environment/secrets
- [ ] **No debug code**: Removed print statements, test code
- [ ] **No commented code**: Removed old code blocks
- [ ] **Imports cleaned**: No unused imports

### Testing Complete

- [ ] **All validations passed**: Checked data, schema, queries
- [ ] **Visual verification done**: Tested with Playwright
- [ ] **All pages tested**: Navigated through entire app
- [ ] **Screenshots captured**: Documented working state
- [ ] **No errors found**: Both code and UI clean

### Documentation

- [ ] **Code comments added**: Complex logic explained
- [ ] **Docstrings updated**: New functions documented
- [ ] **Help text added**: UI tooltips explain features
- [ ] **README updated**: If major feature added

### Git Hygiene

- [ ] **Secrets excluded**: `.gitignore` covers `.streamlit/secrets.toml`
- [ ] **Relevant files staged**: Only changed files committed
- [ ] **Commit message clear**: Describes what and why
- [ ] **Ready to push**: Confident changes work

## 🎯 Quality Gates

### Minimum Quality Requirements

**Data Validation** (MUST have):
- ✅ Queried actual data with Keboola MCP
- ✅ Verified column names from schema
- ✅ Tested SQL syntax before embedding

**Visual Verification** (MUST have):
- ✅ Opened app in browser with Playwright
- ✅ Tested core functionality
- ✅ Took at least one screenshot

**Code Quality** (MUST have):
- ✅ Follows existing patterns
- ✅ No variable name conflicts
- ✅ Session state initialized
- ✅ Error handling present

### Nice to Have

- ⭐ Comprehensive screenshots of all pages
- ⭐ Performance testing done
- ⭐ Edge cases tested
- ⭐ Documentation updated
- ⭐ Code comments added

## 🚦 Traffic Light System

Use this to assess readiness:

### 🔴 RED - Not Ready
- Missing validation (didn't check data)
- Skipped visual testing
- Errors present in UI
- Variable conflicts unresolved

### 🟡 YELLOW - Almost Ready
- Basic validation done
- Some visual testing
- Minor issues remaining
- Needs final verification

### 🟢 GREEN - Ready to Commit
- Full validation complete
- Visual verification done
- All pages tested
- Screenshots captured
- No errors anywhere
- Confident in changes

## 📈 Success Metrics

Track your improvement:

### First Time Using Skill
- Validation time: ~10 minutes
- Build time: ~20 minutes
- Verify time: ~10 minutes
- **Total: ~40 minutes**
- Bugs found: 0 (caught in verify phase)

### After Practice
- Validation time: ~5 minutes (know what to check)
- Build time: ~10 minutes (use templates)
- Verify time: ~5 minutes (know what to test)
- **Total: ~20 minutes**
- Bugs found: 0
- Confidence: High

## 🎊 Completion Criteria

A task is complete when:

✅ **All validation checks passed**
✅ **Code follows best practices**
✅ **Visual verification done**
✅ **Screenshots prove it works**
✅ **No errors in any page**
✅ **Ready to commit with confidence**

---

## Quick Reference Cards

### 🔍 VALIDATE Phase Checklist
```
□ mcp__keboola__get_project_info
□ mcp__keboola__get_table(table_id)
□ mcp__keboola__query_data(test query)
□ Verify column names
□ Test filter conditions
```

### 💻 BUILD Phase Checklist
```
□ Update utils/data_loader.py
□ Update streamlit_dashboard.py
□ Update all page modules
□ Initialize session state
□ No variable conflicts
```

### ✅ VERIFY Phase Checklist
```
□ mcp__playwright__browser_navigate
□ mcp__playwright__browser_wait_for
□ mcp__playwright__browser_take_screenshot
□ Test interactions
□ Check all pages
□ No errors
```

---

**Print this checklist and use it during development!**
