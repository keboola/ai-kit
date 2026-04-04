# Design System — Tokens
*Part of the Keboola Data App design system. See also: design-components.md, design-charts.md*

Production-quality design system for Keboola data apps. Inspired by Keboola's Profit Line Dashboard (profitline-js-app fi-demo).

---

## Color Token System

All colors are defined as CSS custom properties. To rebrand an app, change only the `@theme` block.

### Tailwind CSS 4 (@theme block)

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Brand — CUSTOMIZE THESE */
  --color-brand-primary:   #097cf7;
  --color-brand-secondary: #002151;
  --color-brand-accent:    #ca8a04;

  /* Surface & borders */
  --color-surface:         #f8fafc;
  --color-border:          #e2e8f0;

  /* Semantic */
  --color-positive:        #16a34a;
  --color-negative:        #dc2626;
  --color-warning:         #f59e0b;

  /* Typography */
  --font-sans:             var(--font-sans);
  --font-mono:             var(--font-mono);
}
```

Usage: `bg-brand-primary`, `text-brand-secondary`, `border-border`, `text-negative`.

### JavaScript Constants

```typescript
// lib/constants.ts
export const COLORS = {
  // CUSTOMIZE: Replace hex values with your brand colors.
  // Use hardcoded hex — ECharts cannot resolve CSS custom properties.
  brandPrimary:   '#097cf7',  // Main accent: buttons, links, chart primary
  brandSecondary: '#002151',  // Dark: hover states, text emphasis
  brandAccent:    '#ca8a04',  // Secondary: success, profit, chart secondary

  surface:        '#f8fafc',
  border:         '#e2e8f0',
  positive:       '#16a34a',
  negative:       '#dc2626',
  warning:        '#f59e0b',

  // Chart palette — 6 colors for data series
  chart: ['#097cf7', '#ca8a04', '#1e3a8a', '#059669', '#dc2626', '#8b5cf6'],
} as const
```

---

## Typography

### Fonts

- **Headings + body**: Plus Jakarta Sans (Google Fonts)
- **Code / numbers**: JetBrains Mono (Google Fonts)

```typescript
// app/layout.tsx
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})
```

### Scale

| Use | Size | Weight | Font |
|-----|------|--------|------|
| Page title | 32px / text-3xl | 700 (bold) | Jakarta |
| Section heading | 20px / text-xl | 600 (semibold) | Jakarta |
| KPI value | 28px / text-2xl | 600 (semibold) | JetBrains Mono |
| KPI label | 13px / text-sm | 500 (medium) | Jakarta |
| Body text | 16px / text-base | 400 (normal) | Jakarta |
| Caption / muted | 12px / text-xs | 400 (normal) | Jakarta |
| Table header | 12px / text-xs | 700 (bold) | Jakarta, uppercase, letter-spacing 0.1em |
| Code / data | 14px / text-sm | 400 (normal) | JetBrains Mono |

---

## Number Formatting Standards

All numeric values must use centralized formatters. Never use inline `.toFixed()`, `toLocaleString()`, or string concatenation for formatting numbers.

### Format Rules

| Type | Format | Example | Formatter |
|------|--------|---------|-----------|
| Currency (large, >= $1,000) | `$X,XXX` | `$1,234,567` | `formatCurrency()` |
| Currency (small, < $1,000) | `$X.XX` | `$42.99` | `formatCurrency()` |
| Percentage | `X.X%` | `12.3%` | `formatPercent()` |
| Count | `X,XXX` | `1,234` | `formatCount()` |
| Delta (change) | `+X.X%` / `-X.X%` | `+4.2%`, `-1.8%` | `formatDelta()` |
| Compact (charts/axes) | `$1.2M` / `$890K` | `$1.2M` | `formatCompact()` |

### Centralized Formatters

```typescript
// lib/constants.ts

/**
 * Format currency — 0 decimals for >= $1,000, 2 decimals for < $1,000
 */
export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format percentage — always 1 decimal place
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * Format count — comma-separated, 0 decimals
 */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format delta — always signed, 1 decimal place
 */
export function formatDelta(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

/**
 * Format compact — for chart axes and tooltips ($1.2M, $890K, $42)
 */
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000)     return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)          return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}
```

### Usage

```tsx
import { formatCurrency, formatPercent, formatDelta, formatCompact } from '@/lib/constants'

// KPI card value
<span className="text-2xl font-semibold font-mono">{formatCurrency(1234567)}</span>
// → "$1,234,567"

// KPI delta badge
<span className="text-positive">{formatDelta(12.3)}</span>
// → "+12.3%"

// Chart Y-axis (ECharts)
yAxis: { axisLabel: { formatter: (v: number) => formatCompact(v) } }

// Chart Y-axis (Recharts)
<YAxis tickFormatter={formatCompact} />

// Table cell
cell: ({ getValue }) => formatCurrency(getValue() as number)
```

### Rules

- **Never mix formats in the same column.** If one cell shows `$1,234`, all cells in that column use `formatCurrency()`.
- **Always use the centralized formatters** from `lib/constants.ts`. Never inline `.toFixed()`, template literals with manual formatting, or `toLocaleString()`.
- **Delta values must always show a sign.** `+4.2%` not `4.2%`. The `formatDelta()` function handles this.
- **Chart axes use compact format** (`$1.2M`) — never full numbers on axes.
- **Percentages always have exactly 1 decimal** — `12.3%` not `12%` or `12.34%`.

---

## Z-Layer System

Strict layering prevents overlap issues:

| Layer | Z-index | Element | CSS |
|-------|---------|---------|-----|
| Aurora background | 0 | `body::before` | `position: fixed; z-index: 0;` |
| Page content | 1 | Main content area | `position: relative; z-index: 1;` |
| Sticky KPI bar | 9 | Mini KPIs on scroll | `position: sticky; z-index: 9;` |
| Filter bar | 10 | Sticky filters | `position: sticky; z-index: 10;` |
| Nav tabs | 20 | Tab navigation | `position: sticky; top: 56px; z-index: 20;` |
| Chat panel | 25 | Slide-out AI panel | `position: fixed; right: 0; z-index: 25;` |
| Header | 30 | Sticky top bar | `position: sticky; top: 0; z-index: 30;` |
| Header dropdown | 50 | User menu dropdown | `position: absolute; z-index: 50;` |
| Loading screen | 1000 | Full-screen loader | `position: fixed; z-index: 1000;` |
