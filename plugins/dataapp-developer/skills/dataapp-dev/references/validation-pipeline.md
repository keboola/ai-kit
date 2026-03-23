# Validation Pipeline

Comprehensive validation checklist for Keboola data apps. Run after every build.

---

## 1. Data Validation (Required)

Validate all data assumptions using Keboola MCP before and after building.

### Pre-Build Checks

| Check | Tool | What to verify |
|-------|------|---------------|
| Table exists | `{MCP_TOOL_PREFIX}get_table(table_id)` | Returns schema, not 404 |
| Column names | `{MCP_TOOL_PREFIX}get_table(table_id)` | Exact spelling and case |
| Data types | `{MCP_TOOL_PREFIX}get_table(table_id)` | `database_native_type` matches expectations |
| Fully qualified name | `{MCP_TOOL_PREFIX}get_table(table_id)` | Get `"DB"."schema"."table"` format |
| SQL dialect | `{MCP_TOOL_PREFIX}get_project_info` | Snowflake vs BigQuery (different quoting) |
| Sample data | `{MCP_TOOL_PREFIX}query_data(sql)` | Values match expectations |
| Filter values | `{MCP_TOOL_PREFIX}query_data(sql)` | `SELECT DISTINCT "col"` returns expected options |

### Post-Build Checks

| Check | Method | Pass criteria |
|-------|--------|--------------|
| All queries execute | `{MCP_TOOL_PREFIX}query_data` for each query in the app | No errors |
| Results non-empty | Check row count | At least 1 row returned |
| Column names match code | Compare query results to code references | No KeyError possible |
| Filters produce results | Test each filter value | Non-zero rows for each option |

---

## 2. Visual Verification (Required)

Use Playwright MCP to verify the app renders correctly.

### Startup

```
1. Check port is free: lsof -ti:PORT
2. Start app in background
3. Wait for ready (poll /api/config or check port)
```

### Page-by-Page Verification

For each page in the app:

```
1. mcp__playwright__browser_navigate(url)
2. mcp__playwright__browser_wait_for(time: 3)
3. mcp__playwright__browser_take_screenshot(filename: "page-name.png")
4. Verify: no error messages, data displays, charts render
```

### Interaction Testing

```
1. Click each filter option → verify data updates
2. Click table rows → verify drill-down navigation
3. Switch tabs → verify each page loads
4. If Kai tab: send a test message → verify response streams
```

---

## 3. Design Checklist (Recommended)

### Responsive Screenshots

Take screenshots at 3 viewport widths:

```
mcp__playwright__browser_resize(width: 1440, height: 900)
mcp__playwright__browser_take_screenshot(filename: "desktop.png")

mcp__playwright__browser_resize(width: 1024, height: 768)
mcp__playwright__browser_take_screenshot(filename: "tablet.png")

mcp__playwright__browser_resize(width: 768, height: 1024)
mcp__playwright__browser_take_screenshot(filename: "mobile.png")
```

Verify:
- [ ] No horizontal scroll at any width
- [ ] No overlapping elements
- [ ] KPI grid reflows (4 cols → 2 cols → 1 col)
- [ ] Text remains readable
- [ ] Charts resize properly

### Loading States

```
1. mcp__playwright__browser_navigate(url)  # Don't wait
2. mcp__playwright__browser_take_screenshot(filename: "loading.png")  # Immediately
3. Verify loading screen appears (not blank white)
```

### Z-Layer Verification

```
1. Scroll down the page
2. Verify header stays fixed at top
3. Verify nav tabs stick below header
4. Verify sticky KPI bar appears (if implemented)
5. Verify no content overlaps header/nav
```

### Color Consistency

Verify brand colors are applied (not framework defaults):

```javascript
// Run via mcp__playwright__browser_evaluate
const primary = getComputedStyle(document.documentElement)
  .getPropertyValue('--color-brand-primary').trim()
console.log('Primary color:', primary)
// Should be the user's chosen color, not empty or default
```

---

## 4. Accessibility Check (Recommended)

### ARIA Labels

```javascript
// Run via mcp__playwright__browser_evaluate
const unlabeled = document.querySelectorAll(
  'button:not([aria-label]):not([aria-labelledby]):not(:has(> span))'
)
console.log('Unlabeled buttons:', unlabeled.length)
unlabeled.forEach(b => console.log(' -', b.outerHTML.slice(0, 80)))
```

Pass: 0 unlabeled interactive elements.

### Images Without Alt Text

```javascript
const noAlt = document.querySelectorAll('img:not([alt])')
console.log('Images without alt:', noAlt.length)
```

### Keyboard Navigation

```
1. Press Tab through the page
2. Verify focus indicators are visible on each interactive element
3. Verify Enter activates buttons and links
4. Verify Escape closes modals/popovers
```

### Color Contrast

```javascript
// Check text contrast against background
function getContrast(fg, bg) {
  // Simplified luminance check
  const lum = (hex) => {
    const r = parseInt(hex.slice(1,3), 16) / 255
    const g = parseInt(hex.slice(3,5), 16) / 255
    const b = parseInt(hex.slice(5,7), 16) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const L1 = lum(fg), L2 = lum(bg)
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}
// WCAG AA: ratio >= 4.5 for normal text, >= 3 for large text
```

---

## 5. Performance Check (Required)

### No SELECT *

```bash
# Grep codebase for SELECT *
grep -rn "SELECT \*" --include="*.py" --include="*.ts" --include="*.tsx" --include="*.js"
```

Pass: Zero results (or only in comments/test files).

### Date Filters on Large Tables

```bash
# Check all SQL queries have date constraints
grep -rn "FROM.*WHERE" --include="*.py" --include="*.ts" -A 5 | grep -v "date\|INTERVAL\|CURRENT"
```

Flag any query on time-series tables without date filters.

### Caching Present

**For Next.js (React Query):**
```bash
grep -rn "useQuery\|useStandardQuery\|staleTime" --include="*.ts" --include="*.tsx"
```
Pass: All data fetching uses React Query hooks with staleTime configured.

**For Streamlit:**
```bash
grep -rn "@st.cache_data" --include="*.py"
```
Pass: All query functions are cached.

### Page Load Time

```javascript
// Run via mcp__playwright__browser_evaluate after navigate
const timing = performance.getEntriesByType('navigation')[0]
console.log('DOM interactive:', timing.domInteractive, 'ms')
console.log('Load complete:', timing.loadEventEnd, 'ms')
```

Pass: Load complete < 5000ms.

---

## Validation Report Template

After running all checks, output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Validation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data Validation:     PASS ✓
  Tables verified:   4/4
  Queries tested:    8/8
  Filters validated: 3/3

Visual Verification: PASS ✓
  Pages verified:    4/4
  Interactions:      All working
  Screenshots:       Captured

Design Checklist:    PASS ✓
  Responsive:        3/3 widths OK
  Loading screen:    Present
  Z-layers:          Correct
  Colors:            Brand applied

Accessibility:       WARN ⚠
  ARIA labels:       2 buttons missing (fixed)
  Alt text:          OK
  Keyboard nav:      OK

Performance:         PASS ✓
  No SELECT *:       OK
  Date filters:      All present
  Caching:           All queries cached
  Load time:         2.1s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Overall: READY TO DEPLOY ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Quick Reference

### Must-Have (blocks deployment)
- [ ] All tables exist and schemas match code
- [ ] All queries execute without errors
- [ ] All pages render (visual screenshots)
- [ ] No `SELECT *` in production queries
- [ ] Date filters on time-series queries
- [ ] Caching on all data fetches

### Should-Have (report but don't block)
- [ ] Responsive at 3 viewports
- [ ] Loading states present
- [ ] Color tokens applied (not defaults)
- [ ] ARIA labels on buttons
- [ ] Page load < 5s
- [ ] Z-layers correct
