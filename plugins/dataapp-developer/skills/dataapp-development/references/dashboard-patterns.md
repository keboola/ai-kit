# Dashboard Patterns

**Use this when:** you're building a dashboarding-style app with sidebar filters, charts, metrics, and tables.

## Contents
- SQL-first aggregation
- Sidebar global filters (Streamlit `st.session_state` / React URL search params)
- Project structure
- Charts
- Empty / loading / error states
- Number / currency / percent formatting
- Sortable tables

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
    FROM {table_fqn}
    WHERE "date" >= CURRENT_DATE - INTERVAL '90 days'
        AND {get_filter_clause()}
    GROUP BY "category"
'''
result = execute_query(query)
```

`table_fqn` is the fully qualified name from `mcp__keboola__get_table`'s `fully_qualified_name` field — `"<DATABASE>"."<BUCKET>"."<TABLE>"`. Always use the full FQN with the database prefix; without it, Data Catalog (cross-project linked) tables don't resolve.

Why aggregate in SQL: Snowflake (and similar warehouses) are optimised for this. Loading rows into Python serializes them over the network and burns app memory. SQL aggregation stays in the engine where the data already lives.

Always include a date range filter on time-series queries — otherwise you risk scanning the entire table.

Rules of thumb:
- Aggregate (`GROUP BY`, `AVG`, `SUM`, `COUNT`, `PERCENTILE_CONT`) in SQL.
- Pivot, rank, and window-function in SQL (`ROW_NUMBER`, `LAG`, `LEAD`).
- Limit result sets to display dimensions (`LIMIT 1000` is a reasonable ceiling for a table view; charts need far fewer points).
- Only do row-level work in Python when the SQL dialect can't express it (e.g. parsing irregular JSON blobs).
- If you find yourself loading more than ~50k rows into the app, the query is wrong — push more work down.

## Sidebar global filters

Store filter selections somewhere stable so every page/view reads from the same source, then centralize the SQL fragment they produce.

**Streamlit** — use `st.session_state` as the single source of truth:

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

**React + Express** — store filter selections in the URL search params: they survive reloads, work with browser back/forward, and are shareable. The client reads them and passes them as query params to `/api/*`; the server reuses one filter-clause helper across every route.

Client (`src/hooks/useFilters.ts`):

```tsx
// URL search params are the single source of truth across reloads and shares
export function useFilters() {
  const [params, setParams] = useState(() => new URLSearchParams(window.location.search));
  const filters = {
    userType: params.get('user_type') ?? 'external',
    period: params.get('period') ?? 'l90d',
  };
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    history.replaceState(null, '', `?${next}`);
    setParams(next);
  }
  return { filters, setFilter };
}

// in a component — refetches whenever a filter changes
const { filters } = useFilters();
const summary = useFetch<Summary>(`/api/summary?${new URLSearchParams(filters)}`);
```

Server (`server/queries.ts`):

```ts
import { runSnowflakeQuery } from './kbcQuery';

function getUserTypeFilterClause(userType: string) {
  if (userType === 'external') return `"user_type" = 'External User'`;
  if (userType === 'internal') return `"user_type" != 'External User'`;
  return ''; // all
}

export async function getSummary({ userType }: { userType: string; period: string }) {
  const parts = [`"status" = 'success'`];
  const userFilter = getUserTypeFilterClause(userType);
  if (userFilter) parts.push(userFilter);
  // Add other filters similarly
  return runSnowflakeQuery(`SELECT COUNT(*) AS n FROM ${tableName} WHERE ${parts.join(' AND ')}`);
}
```

Both patterns share the same design: a single filter source, a centralized clause-builder, and queries that fail closed — when a filter helper returns an empty string, that fragment simply isn't appended. The only real difference is where the state lives (`st.session_state` vs URL search params).

## Project structure

Two reasonable layouts depending on app type. Both keep data access centralized and pages thin.

### Streamlit

```text
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
    FROM {table_fqn}
    WHERE {where_clause}
'''
```

### React + Express (`templates/react-vite-app/`)

```text
server/
  index.ts                # Express entry, mounts /api/* routes
  kbcQuery.ts             # runSnowflakeQuery / runBigQueryQuery against the workspace
  queries.ts              # SQL builders, filter helpers
src/
  App.tsx                 # layout, navigation, global filters
  hooks/useFetch.ts       # fetch with retry
  hooks/useFilters.ts     # URL-param filters
  pages/                  # one component per page
    Overview.tsx
    CostAnalysis.tsx
  lib/format.ts           # number / currency / percent formatters
```

`server/index.ts` mounts API routes against the query builders:

```ts
app.get('/api/summary', async (req, res, next) => {
  try {
    const { user_type = 'external', period = 'l90d' } = req.query as Record<string, string>;
    res.json({ data: await getSummary({ userType: user_type, period }) });
  } catch (err) {
    next(err);
  }
});
```

`App.tsx` switches pages on the URL hash — no router needed for a handful of pages:

```tsx
const pages: Record<string, () => JSX.Element> = {
  '#/overview': Overview,
  '#/cost-analysis': CostAnalysis,
};

const [hash, setHash] = useState(window.location.hash);
useEffect(() => {
  const onHash = () => setHash(window.location.hash);
  window.addEventListener('hashchange', onHash);
  return () => window.removeEventListener('hashchange', onHash);
}, []);
const Page = pages[hash] ?? Overview;
```

In both layouts, queries live in one place (`utils/data_loader.py` or `server/queries.ts`), and pages are render-only — they call a function, get rows back, and draw.

## Charts

- **Streamlit:** Plotly Express (`px.line`, `px.bar`, `px.pie`) for quick iteration. Plotly Graph Objects (`go.Figure`, `go.Scatter`) for finer control.
- **React (the template):** Recharts, pre-installed — declarative, good defaults. Reach for ECharts via `echarts-for-react` when you need finer axis/tooltip control or very large series; add it to `package.json`, never from a CDN.

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

TS (`src/lib/format.ts`):
```ts
export const formatCurrency = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const formatPercent = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const formatCount = (v: number) => v.toLocaleString('en-US');
```

When you change formatting (e.g. show currency in EUR), edit the helper once. Otherwise you'll miss a component six months later.

## Sortable tables

Keep numeric columns numeric throughout the pipeline. Sort behaviour follows column type — if a currency column is stored as the string `"$1,234.56"`, sorting falls back to alphabetical and the user sees `$1,000` between `$100` and `$2,000`.

### Streamlit

Use `st.dataframe` with `st.column_config.NumberColumn` to display formatted currency while preserving numeric sort:

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

### React

Keep rows as raw JSON (numbers stay numbers), sort in a `useMemo`, and format only inside the cell. A plain `<table>` with click-to-sort headers is enough for most dashboards — no library required.

```tsx
type Row = { name: string; revenue: number | null; growth_rate: number | null };
type Col = 'revenue' | 'growth_rate';

export function CustomerTable({ rows }: { rows: Row[] }) {
  const [sortBy, setSortBy] = useState<Col>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const va = a[sortBy], vb = b[sortBy];
        if (va == null) return 1; // NULLs to the bottom
        if (vb == null) return -1;
        return sortDir === 'asc' ? va - vb : vb - va;
      }),
    [rows, sortBy, sortDir],
  );

  function setSort(col: Col) {
    if (col === sortBy) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Customer</th>
          <th onClick={() => setSort('revenue')}>Revenue</th>
          <th onClick={() => setSort('growth_rate')}>Growth</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td className="text-right">{r.revenue == null ? '—' : formatCurrency(r.revenue)}</td>
            <td className="text-right">{r.growth_rate == null ? '—' : formatPercent(r.growth_rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Same principle for any JS table library (TanStack Table, AG Grid, etc.): store as `number`, format only at render time. Set the column's sort function so the library compares numbers, not their formatted strings.

Quick checklist before shipping a sortable table:
- Click each numeric column header — does it sort numerically (1, 2, 10, 100), not alphabetically (1, 10, 100, 2)?
- Are NULL/NaN values handled (sent to the bottom on ascending sort, top on descending)?
- Is the formatter consistent with the rest of the dashboard (same helper from `utils/common.py` or `src/lib/format.ts`)?
