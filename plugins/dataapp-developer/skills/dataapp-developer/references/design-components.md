# Design System — Components
*Part of the Keboola Data App design system. See also: design-tokens.md, design-charts.md*

## Table of Contents

- [Header](#header) — Sticky glassmorphism top bar, logo, user menu
- [Keboola Branding](#keboola-branding) — "Powered by Keboola" component
- [Favicon Generation](#favicon-generation) — SVG/PNG favicon setup
- [DataStatusBadge](#datastatusbadge) — "{N} tables loaded" header badge
- [NavTabs](#navtabs) — Sticky horizontal page navigation
- [FilterBar](#filterbar) — Pill buttons and segmented controls
- [KPI Card](#kpi-card) — Metric display: value, delta, sparkline, info popover
- [StickyKpiBar](#stickykpibar) — Mini KPIs on scroll
- [LoadingScreen](#loadingscreen) — Full-screen initial load overlay
- [Data Table](#data-table) — Sortable, hoverable, drill-down capable
- [Empty State Component](#empty-state-component) — Zero-result and error states

---

## Component Specifications

### Header

Sticky top bar, glassmorphism background, 56px height:

```
┌──────────────────────────────────────────────────────────┐
│  [Logo 28px]  App Title          [User avatar] [Name ▼] │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Logo: 28px height, left-aligned with 24px padding
- Title: text-lg font-semibold, next to logo
- User info: Right-aligned, avatar circle + name + dropdown
- Background: `.glass` class
- `position: sticky; top: 0; width: 100%; z-index: 30;`

### Keboola Branding — "Powered by Keboola"

Every data app must include a "Powered by Keboola" attribution in the header. It links to the platform URL and includes the Keboola logo mark.

```tsx
// components/ui/PoweredByKeboola.tsx
'use client'

interface PoweredByKeboolaProps {
  platformUrl?: string  // e.g., "https://connection.north-europe.azure.keboola.com"
  variant?: 'light' | 'dark'
}

export default function PoweredByKeboola({
  platformUrl = '/api/platform',
  variant = 'light',
}: PoweredByKeboolaProps) {
  return (
    <a
      href={platformUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        inline-flex items-center gap-1.5 text-xs
        transition-opacity duration-150
        ${variant === 'light'
          ? 'opacity-40 hover:opacity-70'
          : 'opacity-55 hover:opacity-70'
        }
      `}
      title="Open Keboola platform"
    >
      {/* Keboola icon mark — shipped in template at /public/keboola-icon.svg */}
      <img
        src="/keboola-icon.svg"
        alt="Keboola"
        width={16}
        height={16}
        className={variant === 'dark' ? 'invert' : ''}
      />
      {/* Text — hidden on mobile */}
      <span className="hidden sm:inline">Powered by Keboola</span>
    </a>
  )
}
```

**Placement in Header:**

```tsx
// In Header.tsx — right side, before user avatar
<header className="sticky top-0 z-30 w-full h-14 glass flex items-center justify-between px-6">
  <div className="flex items-center gap-3">
    <AppLogo />
    <span className="text-lg font-semibold">{appTitle}</span>
  </div>
  <div className="flex items-center gap-4">
    <PoweredByKeboola platformUrl={platformUrl} />
    <DataStatusBadge />
    <UserMenu />
  </div>
</header>
```

**Rules:**
- Default opacity: 40% (light variant) or 55% (dark variant) — subtle, not distracting
- Hover opacity: 70% — confirms it is interactive
- Link target: the Keboola platform URL (from `/api/platform` endpoint or env var)
- Text hidden on mobile (`hidden sm:inline`) — only the icon shows on small screens
- Use the Keboola icon mark (symbol without wordmark) — never the full logo
- Light variant: dark icon on light backgrounds. Dark variant: white icon on dark backgrounds.

### Favicon Generation

Every data app needs a favicon. Use the user's logo if available, otherwise fall back to the Keboola icon mark.

**Priority order:**
1. User-provided logo → convert/resize to favicon (SVG preferred, then PNG 32x32)
2. No user logo → use Keboola icon mark (the symbol without text)

**Next.js metadata approach (app/layout.tsx):**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'App Title',
  description: 'Data app powered by Keboola',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}
```

**Manual `<link>` tag approach (for non-Next.js or custom head):**

```html
<!-- In <head> -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

**Default Keboola favicon (SVG):**

```svg
<!-- public/favicon.svg — Keboola icon mark -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <path
    d="M16 0C7.163 0 0 7.163 0 16s7.163 16 16 16 16-7.163 16-16S24.837 0 16 0zm6.4 22.4H9.6V9.6h12.8v12.8z"
    fill="#097cf7"
  />
</svg>
```

**Rules:**
- SVG favicon preferred — scales to any size, supports dark mode via `prefers-color-scheme`
- If user has a logo: place as `public/favicon.svg` (or generate PNG variants)
- If no logo: use the Keboola icon mark in `brand-primary` color
- Always include both SVG and PNG fallbacks (Safari needs PNG)
- Add to the Next.js `metadata.icons` array — never use `<Head>` component in App Router

### DataStatusBadge

Displays the number of Keboola tables loaded by the backend. Placed in the Header right side, before UserMenu.

**Rule:** Always show `"{N} tables loaded"` — NEVER `"Backend connected"`, `"API ready"`, or any connectivity phrasing.

```typescript
// components/layout/DataStatusBadge.tsx — inline in Header.tsx
'use client'

import { useHealthCheck, usePlatformInfo } from '@/lib/api'
import { useState, useRef, useEffect } from 'react'
import { Database, ExternalLink } from 'lucide-react'

export default function DataStatusBadge() {
  const { data } = useHealthCheck()
  const { data: platform } = usePlatformInfo()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = (data as any)?.tables_loaded ?? 0
  const tables: Array<{ short_name: string; row_count: number; table_id: string }> =
    (data as any)?.tables ?? []

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Build the Keboola Storage base URL from platform info
  const storageBase = platform?.connection_url
    ? `${platform.connection_url}/admin/projects/${platform.project_id}/storage`
    : null

  // Build the correct Keboola Storage UI link for a table.
  // table_id format: "{stage}.c-{component}.{table_name}"
  // URL format: {storageBase}/{bucket_id}/overview/table/{table_name}/overview
  // where bucket_id = everything before the last dot.
  function tableLink(tableId: string): string | null {
    if (!storageBase) return null
    const i = tableId.lastIndexOf('.')
    if (i < 0) return null
    const bucket = tableId.slice(0, i)
    const table = tableId.slice(i + 1)
    return `${storageBase}/${bucket}/overview/table/${table}/overview`
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-slate-500 font-medium tabular-nums whitespace-nowrap hover:text-brand-primary transition-colors duration-150"
      >
        <Database size={12} className={count > 0 ? 'text-brand-accent' : 'text-slate-400'} />
        <span className="hidden sm:inline">{count} table{count !== 1 ? 's' : ''} loaded</span>
      </button>
      {open && tables.length > 0 && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <h4 className="text-xs font-semibold text-brand-secondary uppercase tracking-wider">Loaded Tables</h4>
          </div>
          <ul className="py-1">
            {tables.map((t) => {
              const href = tableLink(t.table_id)
              return (
                <li key={t.table_id}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-4 py-2 hover:bg-surface transition-colors group"
                    >
                      <span className="text-xs font-medium text-brand-secondary group-hover:text-brand-primary">{t.short_name}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        {t.row_count.toLocaleString()} rows
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-60" />
                      </span>
                    </a>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-2">
                      <span className="text-xs font-medium text-brand-secondary">{t.short_name}</span>
                      <span className="text-xs text-slate-400">{t.row_count.toLocaleString()} rows</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
```

**Backend:** The `/api/health` endpoint must return `tables_loaded: int` and a `tables` array with `short_name`, `row_count`, and `table_id` per entry.

**Table link URL format:**
```
{connection_url}/admin/projects/{project_id}/storage/{bucket_id}/overview/table/{table_name}/overview
```
- `bucket_id` = table_id up to (not including) the last dot — e.g. `out.c-marketing_metrics`
- `table_name` = table_id after the last dot — e.g. `marketing_metrics`

**Rules:**
- Use `tabular-nums` so the count doesn't shift layout as it updates
- Wrap in `whitespace-nowrap` — never let it line-break
- Hide text on mobile (`hidden sm:inline`) — only the icon shows on small screens
- If health data is unavailable, show nothing (count defaults to 0)
- Table links open in a new tab (`target="_blank"`)
- If platform info is unavailable, render table names without links (graceful degradation)


### NavTabs

Horizontal tabs below header, sticky on scroll:

```
┌──────────────────────────────────────────────────────────┐
│  [icon Overview]  [icon Users]  [icon Trends]  [icon Assistant] │
└──────────────────────────────────────────────────────────┘
```

- Each tab: `display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;`
- Active tab: `font-weight: 600; color: brand-primary; border-bottom: 2px solid brand-primary;`
- Inactive: `color: rgba(0, 33, 81, 0.55);`
- Background: `.glass` class
- `position: sticky; top: 56px; z-index: 20; height: 44px;`
- No emoji in tab labels — use small inline SVG icons (11x11)

### FilterBar

Period selectors and toggles below nav:

```
┌──────────────────────────────────────────────────────────┐
│  [12M] [YTD] [L3M] [L6M] [LQ] [LM]   [Usage|Booking]  │
└──────────────────────────────────────────────────────────┘
```

- Quick periods: Pill buttons, active has `background: brand-secondary; color: white;`
- Segmented toggle: Two-button group with shared border, active side fills
- Compact: `padding: 3px 9px; font-size: 0.82rem; font-weight: 600;`

#### Pill Button Styles

```tsx
{/* FilterBar pill buttons */}
function PillButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string          // e.g. "Filter by L3M period" — passed by parent
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`
        px-3 py-1.5 text-[0.82rem] font-semibold rounded-md
        transition-all duration-150 ease-in-out cursor-pointer
        ${active
          ? 'bg-brand-secondary text-white shadow-sm'
          : 'bg-transparent text-brand-secondary/70 border border-border hover:bg-brand-secondary/5 hover:text-brand-secondary'
        }
      `}
    >
      {children}
    </button>
  )
}
```

```css
/* Pill button CSS equivalent */
.pill-button {
  padding: 6px 12px;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 6px;
  transition: all 150ms ease-in-out;
  cursor: pointer;
}

.pill-button--inactive {
  background: transparent;
  color: rgba(0, 33, 81, 0.7);
  border: 1px solid var(--color-border);
}

.pill-button--inactive:hover {
  background: rgba(0, 33, 81, 0.05);
  color: var(--color-brand-secondary);
}

.pill-button--active {
  background: var(--color-brand-secondary);
  color: #ffffff;
  border: 1px solid var(--color-brand-secondary);
  box-shadow: 0 1px 3px rgba(0, 33, 81, 0.15);
}
```

#### Segmented Control Styles

```tsx
{/* Segmented control — two or more buttons sharing a container */}
function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={opt.value === value}
          aria-label={opt.label}
          className={`
            px-3 py-1.5 text-[0.82rem] font-semibold
            transition-all duration-150 ease-in-out cursor-pointer
            ${opt.value === value
              ? 'bg-brand-secondary text-white'
              : 'bg-white text-brand-secondary/70 hover:bg-brand-secondary/5 hover:text-brand-secondary'
            }
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

```css
/* Segmented control CSS equivalent */
.segmented-control {
  display: inline-flex;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  overflow: hidden;
  /* No gap between segments — they share borders */
}

.segmented-control__item {
  padding: 6px 12px;
  font-size: 0.82rem;
  font-weight: 600;
  transition: all 150ms ease-in-out;
  cursor: pointer;
  border: none;
  outline: none;
}

.segmented-control__item--inactive {
  background: #ffffff;
  color: rgba(0, 33, 81, 0.7);
}

.segmented-control__item--inactive:hover {
  background: rgba(0, 33, 81, 0.05);
  color: var(--color-brand-secondary);
}

.segmented-control__item--active {
  background: var(--color-brand-secondary);
  color: #ffffff;
}
```

**Rules:**
- Pills: inactive = `border + transparent bg`, active = `solid fill + white text`, hover = `5% brand bg`
- Segments: shared container with `overflow-hidden`, no gap between items, active fills solid
- Both: 150ms transitions on all interactive properties
- Never mix pill and segment styles in the same filter bar row

### KPI Card

The core metric display component:

```
┌──────────────────────────────────────────────────────────┐
│  Revenue                                    [ℹ️ popover] │
│                                                          │
│  $1,234,567                                 [sparkline]  │
│  ▲ 12.3% vs prior year                                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Layout: value and delta are STACKED vertically, never side-by-side.** This prevents overflow on narrow cards.

- **Label**: text-sm text-muted font-medium, top-left
- **Value**: text-2xl font-semibold font-mono, animated counter on mount
- **Delta badge**: Inline pill — `▲ 12.3%` green for positive, `▼ -5.2%` red for negative
- **Sparkline**: Tiny line chart (80x28px) right of value, area fill with gradient
- **Info popover**: `ℹ️` icon top-right, click shows definition tooltip
- **Card style**: `bg-white rounded-lg border border-border shadow-sm p-4`
- **Hover**: Subtle shadow lift `box-shadow: 0 4px 12px rgba(0,0,0,0.08)`
- **Accent**: Left border 3px colored by metric category

#### KPI Card Equal Heights

All KPI cards in a grid row must be the same height. Use `h-full` + `min-h-[120px]` to enforce this. Labels must truncate, and sparklines must align to the bottom-right.

```tsx
{/* KPI grid — equal height cards */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {kpis.map(kpi => (
    <div
      key={kpi.id}
      className="bg-white rounded-lg border border-border shadow-sm p-4
                 h-full min-h-[120px] flex flex-col justify-between"
    >
      {/* Top row: label + info icon */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium truncate max-w-[20ch]">
          {kpi.label}
        </span>
        <InfoPopover definition={kpi.definition} />
      </div>

      {/* Bottom: value stacked above delta, sparkline right-aligned */}
      <div className="flex items-end justify-between mt-auto pt-2">
        <div className="min-w-0">
          <div className="text-2xl font-semibold font-mono truncate">
            {formatCurrency(kpi.value)}
          </div>
          <DeltaBadge value={kpi.delta} className="mt-1" />
        </div>
        <Sparkline values={kpi.trend} color={kpi.color} />
      </div>
    </div>
  ))}
</div>
```

**Rules:**
- Grid container: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`
- Each card: `h-full min-h-[120px]` — `h-full` stretches to row height, `min-h` prevents collapse
- Layout: `flex flex-col justify-between` — pushes label top, value+sparkline bottom
- Label: `truncate max-w-[20ch]` — prevents long metric names from breaking layout
- Sparkline: aligned bottom-right via `flex items-end justify-between` on the parent row
- Value row: use `mt-auto` to push to bottom regardless of label line count

#### KPI Info Popover — "How is this calculated?"

Every KPI card MUST have an info icon (top-right) that explains how the metric is calculated. This builds trust in the data.

```tsx
// components/ui/InfoPopover.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

interface InfoPopoverProps {
  title: string            // e.g., "Revenue"
  formula?: string         // e.g., "SUM(bank_revenue + non_bank_revenue + credit_revenue)"
  description: string      // e.g., "Total recognized revenue across all billing types"
  sources?: string[]       // e.g., ["FT_METRIC (BANK_REVENUE)", "FT_METRIC (NON_BANK_REVENUE)"]
}

export default function InfoPopover({ title, formula, description, sources }: InfoPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`
          w-5 h-5 rounded-full inline-flex items-center justify-center text-xs
          transition-all duration-150
          ${open
            ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30'
            : 'bg-gray-100 text-gray-400 border border-transparent hover:bg-brand-primary/5 hover:text-brand-primary'
          }
        `}
        aria-label={`How ${title} is calculated`}
      >
        <Info size={12} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border rounded-xl shadow-2xl z-50 text-left overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border/50">
            <h4 className="text-sm font-semibold text-brand-secondary">{title}</h4>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Formula */}
            {formula && (
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Formula</div>
                <div className="bg-brand-secondary/[0.03] border border-brand-secondary/10 rounded-lg px-3 py-2">
                  <code className="text-xs font-mono text-brand-secondary leading-relaxed break-all">
                    {formula}
                  </code>
                </div>
              </div>
            )}

            {/* Data Sources */}
            {sources && sources.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Data Sources</div>
                <ul className="space-y-1">
                  {sources.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
                      <span className="font-mono text-[11px]">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-surface/50 border-t border-border/50">
            <span className="text-[10px] text-gray-400">Data refreshed on deploy</span>
          </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Usage in KPI card (top-right corner):**

```tsx
<div className="flex items-center justify-between">
  <span className="text-sm text-gray-500 font-medium truncate max-w-[20ch]">{kpi.label}</span>
  <InfoPopover
    title={kpi.label}
    description={kpi.description}
    formula={kpi.formula}
    sources={kpi.sources}
  />
</div>
```

**The KPI data type should include calculation info:**

```typescript
// lib/types.ts
interface KpiItem {
  id: string
  label: string
  value: number
  delta: number
  trend: number[]
  // Calculation info for the info popover
  description: string     // "Total recognized revenue across all billing types"
  formula?: string        // "SUM(bank_revenue + non_bank_revenue)"
  sources?: string[]      // ["FT_METRIC (BANK_REVENUE)", "FT_METRIC (NON_BANK_REVENUE)"]
}
```

**Backend should return calculation metadata:**

```python
# In your KPI endpoint
return {
    "revenue": {
        "value": float(total_revenue),
        "delta": float(delta_pct),
        "trend": trend_values,
        "description": "Total recognized revenue across all billing types",
        "formula": "SUM(BANK_REVENUE + NON_BANK_REVENUE + CREDIT_REVENUE)",
        "sources": ["FT_METRIC (BANK_REVENUE)", "FT_METRIC (NON_BANK_REVENUE)", "FT_METRIC (CREDIT_REVENUE)"],
    }
}
```

**Rules:**
- Every KPI card MUST have an info popover — no exceptions
- `description` is required, `formula` and `sources` are optional
- The backend endpoint must include calculation metadata alongside values
- Popover closes on click outside
- Popover renders at z-50 (Header dropdown slot)

---

#### Animated Counter (CSS)

```css
@property --counter-value {
  syntax: '<number>';
  initial-value: 0;
  inherits: false;
}

.kpi-counter {
  --counter-value: 0;
  transition: --counter-value 1.5s ease-out;
  counter-reset: val var(--counter-value);
}
```

Or use Framer Motion's `useSpring`:
```typescript
const spring = useSpring(0, { stiffness: 50, damping: 15 })
useEffect(() => { spring.set(targetValue) }, [targetValue])
```

#### Sparkline (inline SVG)

```typescript
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 80, h = 28
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#spark-${color})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}
```

### StickyKpiBar

Appears when user scrolls past the KPI cards. Shows mini KPI values:

```
┌──────────────────────────────────────────────────────────┐
│  Revenue: $1.2M ▲12%  │  GP: $890K ▲8%  │  Users: 1.5K │
└──────────────────────────────────────────────────────────┘
```

- `position: sticky; top: 144px; z-index: 9;` (below header 56px + nav 44px + filter 44px)
- `.glass` background
- Uses IntersectionObserver to show/hide: visible when KPI cards scroll out of view
- Compact: `font-size: 0.82rem; padding: 8px 24px;`
- Framer Motion `AnimatePresence` for slide-in/out animation

### LoadingScreen

Full-screen overlay shown during initial data load:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                    [Keboola mascot]                       │
│                    SVG with wave fill                     │
│                                                          │
│                ████████████░░░░░  67%                     │
│                                                          │
│              "Loading DIM_CUSTOMER..."                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Full viewport, `position: fixed; inset: 0; z-index: 1000;`
- Background: white with subtle gradient
- Keboola mascot SVG: Canvas-rendered with wave fill animation (water level = progress)
- Progress bar: Thin bar below mascot, brand-primary color
- Labels rotate through contextual messages:
  - "Connecting to Keboola Storage..."
  - "Loading FT_METRIC..."
  - "Processing KPIs..."
  - "Building charts..."
  - "Almost ready..."
- Fade out when loading complete: `opacity 1 → 0` over 400ms, then `display: none`

### Data Table

Sortable, hoverable, drill-down capable:

```css
.data-table { width: 100%; font-size: 0.94rem; border-collapse: collapse; }

.data-table thead th {
  padding: 0.75rem 1rem;
  font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--color-brand-secondary);
  background: rgba(248, 250, 252, 0.9);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap; user-select: none; cursor: pointer;
}

.data-table thead th:hover { color: var(--color-brand-primary); }

.data-table tbody tr {
  border-bottom: 1px solid var(--color-border);
  transition: all 0.2s ease;
  cursor: pointer;
}

.data-table tbody tr:hover {
  background: linear-gradient(90deg,
    rgba(9, 124, 247, 0.03) 0%,
    rgba(9, 124, 247, 0.01) 100%);
}
```

Sort indicators: `▲` / `▼` appended to active column header.
Click row → navigate to detail page.

### Sort Indicator Styling

Active sort columns must be visually distinct from inactive columns.

| State | Font Weight | Color | Arrow |
|-------|-------------|-------|-------|
| Active ascending | `font-bold` | `text-brand-primary` | `▲` |
| Active descending | `font-bold` | `text-brand-primary` | `▼` |
| Inactive (sortable) | `font-bold` | `text-brand-secondary/55` | None |
| Not sortable | `font-bold` | `text-brand-secondary` | None |

```tsx
{/* In @tanstack/react-table header rendering */}
<th
  key={h.id}
  onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
  className={`
    px-4 py-3 text-left text-xs font-bold uppercase tracking-wider
    transition-colors duration-150
    ${h.column.getIsSorted()
      ? 'text-brand-primary'
      : h.column.getCanSort()
        ? 'text-brand-secondary/55 hover:text-brand-primary cursor-pointer'
        : 'text-brand-secondary'
    }
  `}
>
  <span className="inline-flex items-center gap-1">
    {flexRender(h.column.columnDef.header, h.getContext())}
    {h.column.getIsSorted() === 'asc' && <span className="text-brand-primary">▲</span>}
    {h.column.getIsSorted() === 'desc' && <span className="text-brand-primary">▼</span>}
  </span>
</th>
```

**Rules:**
- Active column: bold + `text-brand-primary` + directional arrow
- Inactive sortable column: dimmed at 55% opacity, no arrow, shows `text-brand-primary` on hover
- Non-sortable columns: no cursor change, no hover effect
- Arrow must be adjacent to the header text with `gap-1`, not appended as a string

### Empty State Component

Shown when a data section has no results — after filtering, on error, or when the dataset is empty. Centered layout with icon, title, message, and optional action button.

```tsx
// components/ui/EmptyState.tsx
'use client'
import { SearchX, Database, WifiOff, type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

const iconMap = {
  'no-results': SearchX,
  'no-data': Database,
  'offline': WifiOff,
} as const

export default function EmptyState({
  icon: Icon = SearchX,
  title,
  message,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-brand-secondary mb-1">
        {title}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {message}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-medium text-brand-primary hover:text-brand-secondary
                     transition-colors duration-150 underline underline-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

**Usage — conditional rendering based on data state:**

```tsx
import EmptyState from '@/components/ui/EmptyState'
import { SearchX, Database, WifiOff } from 'lucide-react'

function DataSection() {
  const { data, isLoading, isError } = useTableData(filters)

  if (isLoading) return <TableSkeleton />

  if (isError) {
    return (
      <EmptyState
        icon={WifiOff}
        title="Connection error"
        message="Could not load data from Keboola. Check your connection and try again."
        action={{ label: 'Retry', onClick: () => window.location.reload() }}
      />
    )
  }

  if (!data?.rows?.length) {
    return (
      <EmptyState
        icon={SearchX}
        title="No results found"
        message="No data matches the current filters. Try adjusting your selection."
        action={{ label: 'Clear filters', onClick: clearAllFilters }}
      />
    )
  }

  return <DataTable data={data.rows} columns={columns} />
}
```

**When to use which icon:**
- `SearchX` — no results for the current filters (most common)
- `Database` — dataset is empty (no data at all, even without filters)
- `WifiOff` — connection or loading error

**Rules:**
- Icon size: always 24px inside a 48px (w-12 h-12) circle background
- Always include both title and message — title alone is insufficient
- Action button is optional but recommended — give the user a way forward
- Use inside the same container/card where the data would normally appear
