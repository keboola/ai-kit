# Validation Pipeline

Comprehensive validation checklist for Keboola data apps. Verification runs in two stages: **localhost first** (before deployment), then **production** (after deployment to Keboola). Delete all screenshots after verification passes.

**Contents:**
- [Stage A: Localhost Verification](#stage-a-localhost-verification)
- [Stage B: Post-Deployment Verification](#stage-b-post-deployment-verification-required)
- [Quick Reference](#quick-reference)
- [Auto-Fix Agent Reference](#auto-fix-agent-reference)

---

## Stage A: Localhost Verification

Run these checks before deployment, against the locally running app.

### 1. Data Validation (Required)

Validate all data assumptions using Keboola MCP before and after building.

### Pre-Build Checks

| Check | Tool | What to verify |
|-------|------|---------------|
| Table exists | `{MCP_TOOL_PREFIX}get_tables(table_ids: [table_id])` | Returns schema, not 404 |
| Column names | `{MCP_TOOL_PREFIX}get_tables(table_ids: [table_id])` | Exact spelling and case |
| Data types | `{MCP_TOOL_PREFIX}get_tables(table_ids: [table_id])` | `database_native_type` matches expectations |
| Fully qualified name | `{MCP_TOOL_PREFIX}get_tables(table_ids: [table_id])` | Get `"DB"."schema"."table"` format |
| SQL dialect | `{MCP_TOOL_PREFIX}get_project_info` | Snowflake vs BigQuery (different quoting) |
| Sample data | `{MCP_TOOL_PREFIX}query_data(query_name: "label", sql_query: sql)` | Values match expectations |
| Filter values | `{MCP_TOOL_PREFIX}query_data(query_name: "label", sql_query: sql)` | `SELECT DISTINCT "col"` returns expected options |

### Post-Build Checks

| Check | Method | Pass criteria |
|-------|--------|--------------|
| All queries execute | `{MCP_TOOL_PREFIX}query_data` for each query in the app | No errors |
| Results non-empty | Check row count | At least 1 row returned |
| Column names match code | Compare query results to code references | No KeyError possible |
| Filters produce results | Test each filter value | Non-zero rows for each option |

---

### 2. Visual Verification (Required)

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
4. If AI chat tab: send a test message → verify response streams
```

---

### 3. Design Checklist (Recommended)

### Responsive Screenshots

Take screenshots at 3 viewport widths:

```
mcp__playwright__browser_resize(width: 1440, height: 900)
mcp__playwright__browser_take_screenshot(filename: "desktop.png")

mcp__playwright__browser_resize(width: 768, height: 1024)
mcp__playwright__browser_take_screenshot(filename: "tablet.png")

mcp__playwright__browser_resize(width: 375, height: 812)
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
2. Verify header stays sticky at top while scrolling
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

### 3b. Visual Quality Checks (Required)

Verify polished visual details that distinguish a production app from a prototype. Run each check via Playwright evaluate or grep.

### Bento Grid Row Heights (KPI cards + all grid items)

```javascript
// Run via mcp__playwright__browser_evaluate — checks ALL bento grid rows, not just KPIs
const gridItems = [...document.querySelectorAll('.bento-grid > *, [class*="grid"] > [class*="card"], [class*="kpi"], [class*="metric"]')]
const rows = new Map()
gridItems.forEach(el => {
  const top = Math.round(el.getBoundingClientRect().top)
  if (!rows.has(top)) rows.set(top, [])
  rows.get(top).push(Math.round(el.getBoundingClientRect().height))
})
rows.forEach((heights, top) => {
  const unique = [...new Set(heights)]
  console.log(`Row y=${top}: heights=${JSON.stringify(unique)} ${unique.length === 1 ? 'PASS' : 'FAIL — unequal heights'}`)
})
```

Pass: Every row in the bento grid reports a single unique height value. Cards in the same row MUST be equal height.

### Chart Y-Axis at Zero

```bash
# Grep codebase for charts missing explicit domain/scale starting at 0
grep -rn "domain\|scale\|yAxis\|y_axis\|rangeMin\|min:" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py"
```

Verify: Every chart definition either explicitly sets `domain: [0, ...]` / `min: 0`, or uses a chart library default that starts at zero. Flag any chart with a truncated Y-axis.

### Number Format Consistency

```javascript
// Run via mcp__playwright__browser_evaluate
const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
const currencies = [], percents = [], deltas = []
while (textNodes.nextNode()) {
  const t = textNodes.currentNode.textContent.trim()
  if (/^\$[\d,.]+/.test(t)) currencies.push(t)
  if (/[\d.]+%/.test(t)) percents.push(t)
  if (/^[+-][\d,.]+/.test(t)) deltas.push(t)
}
console.log('Currencies:', currencies.slice(0, 10), '— expect 0 decimals')
console.log('Percents:', percents.slice(0, 10), '— expect 1 decimal')
console.log('Deltas:', deltas.slice(0, 10), '— expect signed (+/-)')
```

Pass: Currency values use 0 decimal places, percentages use 1 decimal place, and delta values include a sign prefix.

### Data Status Badge

```
1. mcp__playwright__browser_take_screenshot(filename: "header-status.png")
2. Verify header contains a "tables loaded" count or data connection status text
3. mcp__playwright__browser_click on the status badge
4. mcp__playwright__browser_take_screenshot(filename: "status-tooltip.png")
5. Verify tooltip/popover shows data freshness or connection details
```

Pass: Status badge is visible in the header and reveals additional info on click.

### Keboola Branding

```
1. mcp__playwright__browser_take_screenshot(filename: "branding.png")
2. Verify Keboola logo is visible (header or footer)
3. mcp__playwright__browser_click on the logo
4. Verify it links to keboola.com or the project dashboard
```

Pass: Logo is present and clickable.

### Filter Control Styling

```javascript
// Run via mcp__playwright__browser_evaluate
const filters = [...document.querySelectorAll('select, [role="combobox"], [class*="filter"], [class*="segmented"], [class*="pill"]')]
filters.forEach(f => {
  const style = getComputedStyle(f)
  const hasBorder = style.border !== 'none' && style.borderWidth !== '0px'
  const hasBg = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent'
  console.log(f.tagName, f.className.slice(0, 40), '— border:', hasBorder, 'bg:', hasBg,
    (hasBorder || hasBg) ? 'PASS' : 'FAIL — looks like unstyled generic element')
})
```

Pass: All filter controls have visible border or background styling (pill, segmented, or select appearance — not plain unstyled buttons).

### Empty States

```
1. Apply filters that produce zero results (e.g., extreme date range, nonexistent category)
2. mcp__playwright__browser_take_screenshot(filename: "empty-state.png")
3. Verify an empty-state message or illustration renders (not a blank area or broken layout)
4. Reset filters back to defaults
```

Pass: Zero-result filters show an explicit empty-state UI, not a blank or broken view.

### Text Truncation

```javascript
// Run via mcp__playwright__browser_evaluate
const overflowing = []
document.querySelectorAll('*').forEach(el => {
  if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
    const text = el.textContent.trim().slice(0, 60)
    if (text.length > 0) overflowing.push({ tag: el.tagName, class: el.className.toString().slice(0, 30), text })
  }
})
console.log('Overflowing elements:', overflowing.length)
overflowing.slice(0, 10).forEach(o => console.log(` ${o.tag}.${o.class}: "${o.text}"`))
```

Pass: 0 overflowing elements (or only intentionally truncated elements with `text-overflow: ellipsis`).

### Chart Responsiveness

```
1. mcp__playwright__browser_resize(width: 375, height: 812)
2. mcp__playwright__browser_take_screenshot(filename: "charts-mobile.png")
3. Verify charts are readable: labels not overlapping, legends not cut off, data points visible
4. mcp__playwright__browser_resize(width: 1440, height: 900)  # Reset
```

Pass: Charts remain legible at 375px width.

### Decimal Consistency

```
1. mcp__playwright__browser_take_screenshot(filename: "decimal-check.png")
2. Visually inspect each column/section for mixed decimal formats
   (e.g., one cell shows "42.1%" while another shows "38.25%")
```

Pass: All values in the same column or section use identical decimal precision.

### Favicon

```javascript
// Run via mcp__playwright__browser_evaluate
const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')
console.log('Favicon element:', favicon ? favicon.outerHTML : 'MISSING')
console.log('Favicon href:', favicon ? favicon.href : 'NONE')
```

Pass: A `<link rel="icon">` element exists in the document head with a valid href.

---

### 4. Accessibility Check (Required (auto-fixed))

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
// Run via mcp__playwright__browser_evaluate on each page
(function() {
  function srgbToLinear(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function luminance(r, g, b) {
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  }
  function contrastRatio(l1, l2) {
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function parseColor(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  const results = [];
  document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,label,td,th,li').forEach(el => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || !el.textContent?.trim()) return;
    const fg = parseColor(style.color);
    const bg = parseColor(style.backgroundColor);
    if (!fg || !bg || (bg[0] === 0 && bg[1] === 0 && bg[2] === 0 && style.backgroundColor.includes('0)'))) return;
    const fgL = luminance(...fg);
    const bgL = luminance(...bg);
    const ratio = contrastRatio(fgL, bgL);
    const fontSize = parseFloat(style.fontSize);
    const isBold = parseInt(style.fontWeight) >= 700;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && isBold);
    const threshold = isLarge ? 3 : 4.5;
    if (ratio < threshold) {
      results.push({
        tag: el.tagName, text: el.textContent.trim().slice(0,40),
        ratio: ratio.toFixed(2), required: threshold,
        fg: style.color, bg: style.backgroundColor
      });
    }
  });
  return results.length === 0
    ? 'CONTRAST_PASS'
    : 'CONTRAST_FAIL: ' + results.map(r => `${r.tag} "${r.text}" ratio=${r.ratio} (need ${r.required})`).join(' | ');
})()
```

**Auto-fix contrast failures:**
1. Identify the failing foreground/background pair
2. If foreground is too light on white/surface background: darken the foreground color
3. If background is too similar to foreground: lighten the background or darken the foreground
4. Edit the CSS/Tailwind class in globals.css or the specific component
5. Re-run the contrast check to confirm the fix

---

### 5. Performance Check (Required)

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


### Page Load Time

```javascript
// Run via mcp__playwright__browser_evaluate after navigate
const timing = performance.getEntriesByType('navigation')[0]
console.log('DOM interactive:', timing.domInteractive, 'ms')
console.log('Load complete:', timing.loadEventEnd, 'ms')
```

Pass: Load complete < 5000ms.

---

### Stage A Report Template

After running all localhost checks, output:

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

Visual Quality:      PASS ✓
  KPI heights:       Equal
  Y-axis at zero:    All charts
  Number formats:    Consistent
  Keboola branding:  Present
  Filter styling:    Pill/segmented
  Empty states:      Handled
  Truncation:        No overflow
  Favicon:           Present

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
  Localhost: READY TO DEPLOY ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Stage B: Post-Deployment Verification (Required)

After the app is deployed to Keboola, verify it works in production:

### Production Smoke Test

1. Navigate to the Keboola Data App URL with Playwright
2. Screenshot the main page — verify it matches localhost
3. Click through each page — verify navigation works
4. Verify data loads correctly (not empty states)

### Console Error Check

Use Playwright to check the browser console on the deployed URL:
```
mcp__playwright__browser_console_messages
```

Look for:
- CORS errors (backend URL misconfigured)
- 401/403 auth errors (missing `dataApp.secrets`)
- Failed API calls (`/api/*` routes returning errors)
- CSP violations or mixed content warnings
- React hydration mismatches

### Health Probe

Verify the Keboola health probe:
- POST to `/` must return 200
- This is how the platform confirms the app is running

### Cleanup

**Delete ALL screenshots** created during both localhost and production verification. No screenshot files should remain after verification is complete.

### Post-Deployment Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Production Verification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Visual:        PASS (matches localhost)
Console:       PASS (0 errors)
Health probe:  PASS (POST / → 200)
Screenshots:   Deleted

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Overall: LIVE AND VERIFIED ✓
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
- [ ] Console clean — no JavaScript errors
- [ ] Health probe works (POST / → 200)
- [ ] KPI card heights equal in same row
- [ ] Chart Y-axis starts at 0
- [ ] Number formats consistent
- [ ] Keboola branding present
- [ ] Filter controls properly styled
- [ ] Favicon present
- [ ] My Dashboards page loads (/custom)

### Should-Have (report but don't block)
- [ ] Responsive at 3 viewports
- [ ] Loading states present
- [ ] Color tokens applied (not defaults)
- [ ] ARIA labels on buttons
- [ ] Page load < 5s
- [ ] Z-layers correct
- [ ] Data status badge clickable
- [ ] Empty states for zero-result filters
- [ ] Text truncation (no overflow)
- [ ] Chart responsive at 375px
- [ ] Decimal consistency within columns

---

## Auto-Fix Agent Reference

Used by the Phase 5 verification+fix agent. After confirming a check fails, apply the fix listed below, wait 2s for hot reload, then re-run only that check.

### FIX GUIDE

| Check | File to edit | Fix |
|-------|-------------|-----|
| Brand color not applied | `frontend/app/globals.css` | Replace `@theme --color-brand-primary` value |
| Favicon missing | `frontend/app/layout.tsx` | Add `icons: { icon: '/keboola-icon.svg' }` to metadata |
| "Backend connected" text | `frontend/components/layout/Header.tsx` | Replace with DataStatusBadge pattern from `design-components.md` |
| Data status badge missing | `frontend/components/layout/Header.tsx` | Implement DataStatusBadge from `design-components.md` |
| KPI heights unequal | `frontend/app/(dashboard)/page.tsx` | Add `min-h-[120px] h-full flex flex-col` to each KPI card wrapper |
| Number format wrong (`.toFixed`) | `frontend/lib/` and `app/` | Replace `.toFixed(N)` with formatters from `lib/constants.ts` |
| Filter styling missing | `frontend/app/(dashboard)/page.tsx` | Add pill/segmented CSS per `design-components.md` |
| SELECT * in backend | `backend/routers/*.py` | Replace with specific column list |
| staleTime missing | `frontend/lib/api.ts` | Add `staleTime: 5 * 60 * 1000` to each `useQuery` call |
| Console JS errors | `frontend/app/` or `backend/` | Read error, fix root cause |
| Color contrast below WCAG AA (4.5:1 normal, 3:1 large) | `frontend/app/globals.css` | Darken foreground `--color-brand-primary` until ratio meets threshold |

### VERIFICATION REPORT Template

Return ONLY this block (fill in PASS/FIXED/AUTO-FIX for each item):

```
VERIFICATION REPORT
===================
Backend health:       [PASS|FIXED|AUTO-FIX] — {detail}
Brand color:          [PASS|FIXED|AUTO-FIX] — {detail}
Favicon:              [PASS|FIXED|AUTO-FIX]
Data status badge:    [PASS|FIXED|AUTO-FIX] — {text found}
KPI heights:          [PASS|FIXED|AUTO-FIX]
Number formats:       [PASS|FIXED|AUTO-FIX]
Filter styling:       [PASS|FIXED|AUTO-FIX]
Console errors:       [PASS|FIXED|AUTO-FIX] — {N errors}
Mobile layout:        [PASS|FIXED|AUTO-FIX]
Additional pages:     [PASS|FIXED|AUTO-FIX]
No SELECT *:          [PASS|FIXED|AUTO-FIX]
staleTime set:        [PASS|FIXED|AUTO-FIX]
My Dashboards (/custom): [PASS|FIXED|AUTO-FIX]
KAI widget (if AI):   [PASS|FIXED|AUTO-FIX|N/A]
Color contrast:       [PASS|FIXED|AUTO-FIX]
OVERALL: [PASS|fix automatically]
AUTO_FIXED: {list fixed items, or "none"}
AUTO_FIX_REQUIRED: {list items to fix automatically, or "none"}
```

Delete all screenshots after reporting.
