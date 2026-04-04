# Design System — Advanced Patterns & Interactions
*Best practices for building and enhancing data apps. Loaded during Phase 0E (Enhance) for coherent feature additions, and on-demand during new builds. See also: design-tokens.md, design-components.md, design-charts.md*

---

## Design Patterns

**Contents:**
- [Text Truncation Rules](#text-truncation-rules)
- [Skeleton Shimmer (CSS)](#skeleton-shimmer-css)
- [Spacing & Layout](#spacing--layout)
- [KPI Card Best Practices](#kpi-card-best-practices)
- [Bento Grid Height Rules](#bento-grid-height-rules)
- [Framer Motion Patterns](#framer-motion-patterns)
- [Accessible Color Patterns](#accessible-color-patterns)

---

### Text Truncation Rules

Prevent layout shifts and overflow. Never let text wrap unpredictably.

| Context | Max Width | Behavior |
|---------|-----------|----------|
| Table cells | `max-w-[30ch]` | Truncate with ellipsis |
| KPI / card labels | `max-w-[20ch]` | Truncate with ellipsis |
| Section headers | No max | Never wrap — use shorter text |
| Chart axis labels | `max-w-[12ch]` | Truncate with ellipsis |
| Tooltip content | `max-w-[40ch]` | Allow wrapping |

```tsx
{/* Table cell truncation */}
<td className="px-4 py-3 max-w-[30ch] truncate" title={fullText}>
  {fullText}
</td>

{/* KPI label truncation */}
<span className="text-sm text-gray-500 font-medium truncate max-w-[20ch] block">
  {label}
</span>

{/* Chart axis label truncation (ECharts) */}
axisLabel: {
  width: 96,           // ~12ch
  overflow: 'truncate',
  ellipsis: '...',
}

{/* Chart axis label truncation (Recharts) */}
<XAxis
  dataKey="name"
  tick={{ fontSize: 12 }}
  tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 11) + '…' : v}
/>

{/* Section header — never truncate, but enforce single line */}
<h2 className="text-xl font-semibold text-brand-secondary whitespace-nowrap">
  {title}
</h2>
```

**Rules:**
- Always add `title={fullText}` on truncated elements so the full value shows on hover
- Table: use `truncate` (which applies `overflow-hidden text-ellipsis whitespace-nowrap`)
- Card labels: combine `truncate` with `max-w-[20ch] block`
- Chart axes: use the chart library's built-in overflow/truncation — do not CSS-truncate SVG text
- Headers: if a header is too long, shorten the copy rather than truncating

---

### Skeleton Shimmer (CSS)

```css
.skeleton-shimmer {
  background: linear-gradient(90deg, rgba(0,33,81,0.04) 25%, rgba(0,33,81,0.08) 50%, rgba(0,33,81,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Use: `<div className="skeleton-shimmer h-24 rounded-lg" />` while data loads.

#### Skeleton Shape Matching

Skeletons must match the dimensions of the content they replace. This prevents layout shift when data loads.

| Component | Skeleton Height | Skeleton Shape |
|-----------|----------------|----------------|
| KPI card | `h-[120px]` | Rounded card with label bar + value bar + sparkline bar |
| Table row | `h-8` | Full-width bar per row, stacked |
| Chart area | `h-[400px]` (desktop) | Rounded card matching chart container |
| Section heading | `h-6 w-48` | Short bar |
| Filter bar | `h-10` | Row of small pill shapes |

```tsx
// components/skeletons/KpiSkeleton.tsx
export function KpiSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-border shadow-sm p-4 h-[120px] flex flex-col justify-between">
      <div className="skeleton-shimmer h-4 w-24 rounded" />
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-7 w-32 rounded" />
          <div className="skeleton-shimmer h-3 w-20 rounded" />
        </div>
        <div className="skeleton-shimmer h-7 w-20 rounded" />
      </div>
    </div>
  )
}

// components/skeletons/TableSkeleton.tsx
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg border border-border shadow-sm p-4 space-y-0">
      {/* Header row */}
      <div className="flex gap-4 pb-3 border-b border-border mb-2">
        <div className="skeleton-shimmer h-4 w-24 rounded" />
        <div className="skeleton-shimmer h-4 w-32 rounded" />
        <div className="skeleton-shimmer h-4 w-20 rounded" />
        <div className="skeleton-shimmer h-4 w-16 rounded" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <div className="skeleton-shimmer h-4 w-28 rounded" />
          <div className="skeleton-shimmer h-4 w-36 rounded" />
          <div className="skeleton-shimmer h-4 w-16 rounded" />
          <div className="skeleton-shimmer h-4 w-12 rounded" />
        </div>
      ))}
    </div>
  )
}

// components/skeletons/ChartSkeleton.tsx
export function ChartSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-border shadow-sm p-6">
      <div className="skeleton-shimmer h-5 w-40 rounded mb-4" />
      <div className="skeleton-shimmer h-[240px] md:h-[320px] lg:h-[400px] w-full rounded-lg" />
    </div>
  )
}
```

**Usage — replace real components while loading:**

```tsx
import { KpiSkeleton } from '@/components/skeletons/KpiSkeleton'
import { ChartSkeleton } from '@/components/skeletons/ChartSkeleton'

function DashboardPage() {
  const { data, isLoading } = useKpis(period)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {isLoading
        ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        : data?.kpis.map(kpi => <KpiCard key={kpi.id} {...kpi} />)
      }
    </div>
  )
}
```

**Rules:**
- Every data-driven component must have a matching skeleton
- Skeleton height must match the rendered component height exactly
- Use the same grid/flex layout for skeletons as for real content
- Never show a generic spinner — always use shape-matched skeletons

---

### Spacing & Layout

| Element | Padding | Gap |
|---------|---------|-----|
| Page container | `px-6 py-4` | — |
| Card grid | — | `gap-4` |
| Between sections | — | `gap-6` (24px) |
| Card internal | `p-4` (compact) or `p-6` (featured) | — |
| KPI grid | 4 columns on desktop, 2 on tablet, 1 on mobile | `gap-4` |
| Chart container | `p-6` | — |

#### Card Padding Consistency

Padding must be consistent per card type. Never mix padding values within the same card category.

| Card Type | Padding | When |
|-----------|---------|------|
| KPI card | `p-4` (16px) | Always — compact metrics need tight spacing |
| Chart card | `p-6` (24px) | Always — charts need breathing room for axes/legends |
| Table card | `p-4` body, `px-4 py-3` cells | Always — dense data needs compact layout |
| Featured / hero card | `p-6` (24px) | Only for single highlighted metrics |

```tsx
{/* CORRECT — consistent KPI padding */}
<div className="bg-white rounded-lg border border-border shadow-sm p-4">
  <KpiContent />
</div>

{/* CORRECT — consistent chart padding */}
<div className="bg-white rounded-lg border border-border shadow-sm p-6">
  <ChartContent />
</div>

{/* WRONG — never use p-3 or p-5 on cards */}
{/* <div className="... p-3"> <- too tight */}
{/* <div className="... p-5"> <- non-standard, pick p-4 or p-6 */}
```

**Rules:**
- KPI cards: always `p-4`. No exceptions.
- Chart cards: always `p-6`. No exceptions.
- Never use `p-3` or `p-5` on any card — these are not in the spacing scale.
- If a card contains both a KPI and a chart, use `p-6` (the larger value wins).

#### Responsive Breakpoints

```css
/* Mobile: < 768px — single column, stacked */
/* Tablet: 768-1200px — 2 columns, sidebar overlay */
/* Desktop: > 1200px — 4 columns, full layout */

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}
```

---

### KPI Card Best Practices

A modern KPI card must include context, not just a number:

```
+-----------------------------+
|  Revenue          ^ +4.2%   |  <- delta badge (color + arrow icon)
|  $1.2M                      |  <- main value (.mono for tabular nums)
|  sparkline                  |  <- sparkline (30-day trend)
|  vs $1.15M last period      |  <- comparison context
+-----------------------------+
```

Key elements:
- **Delta badge**: Always pair color with icon (up/down arrow) — never rely on color alone (colorblind a11y)
- **Sparkline**: Use a simple SVG `<polyline>` or ECharts mini chart
- **Tabular numbers**: Use `.mono` class so digits align vertically in columns
- **Skeleton loading**: Show `.skeleton` placeholder (from globals.css) while data loads

---

### Bento Grid Height Rules

Cards in the **same grid row** MUST have equal height. Unequal heights look broken and fail validation.

**Rules:**
- Use CSS Grid default `align-items: stretch` — **do NOT override with `align-items: start`**
- If card content varies (short vs tall), enforce a minimum: `className="... min-h-[180px]"`
- For KPI cards specifically, use `min-h-[140px]` so they never collapse smaller than the tallest card in the row

**What breaks height alignment:**
```css
/* BAD — cards shrink to content */
.bento-grid { align-items: start; }

/* GOOD — cards stretch to fill row height */
.bento-grid { /* default: align-items: stretch */ }
```

**Fixing mismatched heights:**
```tsx
// BAD — content-driven height
<div className="card">...</div>

// GOOD — minimum height ensures alignment
<div className="card min-h-[160px] flex flex-col">...</div>
```

---

### Framer Motion Patterns

```tsx
// Card stagger — animate cards appearing one by one
import { motion } from 'framer-motion'

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }
const card = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
}

<motion.div variants={container} initial="hidden" animate="visible" className="bento-grid">
  <motion.div variants={card} className="span-3">KPI Card</motion.div>
  <motion.div variants={card} className="span-3">KPI Card</motion.div>
</motion.div>
```

---

### Accessible Color Patterns

Never rely on color alone for meaning — always pair with an icon or text:

| Meaning | Color | Icon | CSS class |
|---------|-------|------|-----------|
| Positive / Growth | `--color-positive` | up arrow or `<TrendingUp />` | `text-positive` |
| Negative / Decline | `--color-negative` | down arrow or `<TrendingDown />` | `text-negative` |
| Warning / Caution | `--color-warning` | `<AlertTriangle />` | `text-warning` |
| Neutral | gray-400 | `<Minus />` | `text-gray-400` |

---

## Interaction Patterns

**Contents:**
- [Data Status Indicator](#data-status-indicator) — Clickable header badge showing loaded tables + row counts
- [React Portals — Floating UI Pattern](#react-portals) — Dropdowns, tooltips rendered outside DOM hierarchy
- [URL Filter State](#url-filter-state) — Shareable filter state via URL search params
- [Error Boundary](#error-boundary) — Graceful per-section error handling
- [Animations](#animations) — Page transitions, stagger, AnimatePresence patterns

---

### Data Status Indicator — Header Tooltip Pattern

The Header shows a dynamic "Data connected" / "Connecting..." indicator. When clicked, it opens a tooltip/popover showing which Keboola tables are loaded, their row counts, and load time. This gives users confidence that the data is fresh and complete.

**Backend: Add `/api/data-status` endpoint**

```python
# routers/status.py
from fastapi import APIRouter, Depends
from services.data_loader import get_data

router = APIRouter()

@router.get("/data-status")
def data_status(data: dict = Depends(get_data)):
    """Return loaded table names, row counts, and status."""
    tables = []
    for name, df in data.items():
        tables.append({
            "name": name,
            "rows": len(df),
            "columns": len(df.columns),
            "status": "loaded",
        })
    return {
        "connected": len(tables) > 0,
        "table_count": len(tables),
        "tables": tables,
    }
```

Register in main.py: `app.include_router(status.router, prefix="/api")`

**Frontend: Add hook**

```typescript
// lib/types.ts
export interface DataStatusTable {
  name: string
  rows: number
  columns: number
  status: string
}

export interface DataStatusResponse {
  connected: boolean
  table_count: number
  tables: DataStatusTable[]
}

// lib/api.ts
export function useDataStatus() {
  return useQuery<DataStatusResponse>({
    queryKey: ['data-status'],
    queryFn: () => apiFetch('/api/data-status'),
    staleTime: 60_000,
  })
}
```

**Frontend: Header tooltip component**

```tsx
// In Header.tsx — replace the static status indicator
'use client'
import { useState, useRef, useEffect } from 'react'
import { useDataStatus } from '@/lib/api'

function DataStatusBadge() {
  const { data } = useDataStatus()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const connected = data?.connected ?? false

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-80"
      >
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-positive' : 'bg-warning animate-pulse'}`}
          role="status"
        />
        <span className={connected ? 'text-positive' : 'text-warning'}>
          {connected ? `${data?.table_count ?? 0} tables loaded` : 'Connecting...'}
        </span>
      </button>

      {/* Tooltip popover */}
      {open && data?.tables && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-border rounded-lg shadow-lg z-50 p-3">
          <div className="text-xs font-semibold text-brand-secondary mb-2">
            Keboola Data Status
          </div>
          {data.tables.length === 0 ? (
            <p className="text-xs text-gray-400">No tables loaded</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-1">Table</th>
                  <th className="pb-1 text-right">Rows</th>
                  <th className="pb-1 text-right">Cols</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.map(t => (
                  <tr key={t.name} className="border-t border-border/50">
                    <td className="py-1 font-medium text-brand-secondary">{t.name}</td>
                    <td className="py-1 text-right mono">{t.rows.toLocaleString()}</td>
                    <td className="py-1 text-right mono">{t.columns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
```

**Key rules:**
- The badge text changes dynamically: "Connecting..." -> "3 tables loaded"
- Click to expand, click outside to close
- Tooltip shows table name, row count, column count
- Uses z-50 (Header dropdown slot from the z-index scale)
- The popover is positioned `absolute right-0 top-full` so it drops down from the badge
- Uses `.mono` class for numbers (tabular alignment)

---

### React Portals — Floating UI Pattern

Portals render elements outside the normal DOM tree, escaping parent `overflow: hidden` and stacking context issues. Use for any floating UI that must appear above all other content.

**When to use portals:**
- Modals / dialogs (z-40)
- Slide-out drawers (z-40)
- Toast notifications (z-50)
- Dropdown menus that overflow their parent container

**Base Portal component:**

```tsx
// components/ui/Portal.tsx
'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}
```

**Usage with a modal:**

```tsx
import Portal from '@/components/ui/Portal'

function DetailModal({ open, onClose, children }: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-40 w-full max-w-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <button onClick={onClose} className="absolute top-4 right-4" aria-label="Close">
          <X size={20} />
        </button>
        <div className="p-6 overflow-y-auto h-full">
          {children}
        </div>
      </div>
    </Portal>
  )
}
```

**Z-index slots for portals** (from globals.css):
- z-40: modals, overlays, drawers
- z-50: toasts (always on top of modals)

**Key rules:**
- Always use `<Portal>` for floating UI — never absolute-position inside a card
- Always add a backdrop with `onClick={onClose}` for modals
- Always trap focus inside modals (`role="dialog"` + `aria-modal="true"`)
- Always provide keyboard dismiss (Escape key)

---

### URL Filter State

Filter state must be stored in the URL so users can share exact dashboard views. When a user applies a filter, the URL updates. When someone opens that URL, they see the same filtered view.

**Pattern: useSearchParams + URL sync**

```tsx
'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

function useFilterState(key: string, defaultValue: string) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const value = searchParams.get(key) ?? defaultValue

  const setValue = (newValue: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newValue === defaultValue) {
      params.delete(key)  // Clean URL when using default
    } else {
      params.set(key, newValue)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return [value, setValue] as const
}

// Usage:
const [period, setPeriod] = useFilterState('period', 'ytd')
const [region, setRegion] = useFilterState('region', 'all')

// URL becomes: /dashboard?period=l3m&region=eu
// Share this URL -> recipient sees exact same filtered view
```

**Include filter params in React Query keys:**

```tsx
export function useKpis(period: string, region: string) {
  return useQuery<KpiResponse>({
    queryKey: ['kpis', period, region],  // Cache per filter combination
    queryFn: () => apiFetch(`/api/kpis?period=${period}&region=${region}`),
  })
}
```

**Best practices:**
- Default values should NOT appear in the URL (keep it clean)
- Always use `router.replace()` not `router.push()` — filters shouldn't create browser history entries
- Include `{ scroll: false }` to prevent page jump on filter change
- Always include filter values in React Query `queryKey` for proper cache isolation

---

### Error Boundary

React error boundaries catch JavaScript errors in the component tree and display a fallback UI instead of crashing the entire page.

**Error boundary component:**

```tsx
// components/ui/ErrorBoundary.tsx
'use client'
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-xl border border-negative/20 bg-negative/5 p-6 text-center">
          <p className="text-sm font-medium text-negative">Something went wrong</p>
          <p className="mt-1 text-xs text-gray-500">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 text-xs text-brand-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Usage — wrap individual sections, not the whole page:**

```tsx
// Wrap each independent section so one crash doesn't kill the page
<div className="bento-grid">
  <ErrorBoundary>
    <KpiCards />
  </ErrorBoundary>

  <ErrorBoundary>
    <TrendChart />
  </ErrorBoundary>

  <ErrorBoundary>
    <DataTable />
  </ErrorBoundary>
</div>
```

**Key rules:**
- Wrap each bento grid section independently — a chart crash shouldn't hide KPIs
- Error boundaries MUST be class components (React limitation)
- The `'use client'` directive is required
- Always include a "Try again" button that resets the error state

---

### Animations

#### Card Stagger (Framer Motion)

```typescript
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
}

// Usage:
<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {cards.map(card => (
    <motion.div key={card.id} variants={cardVariants}>
      <KpiCard {...card} />
    </motion.div>
  ))}
</motion.div>
```

#### Section Fade-in

```typescript
const sectionVariants = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
}

<motion.section
  variants={sectionVariants}
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true, margin: "-50px" }}
>
  {children}
</motion.section>
```
