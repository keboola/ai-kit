# Design System Reference

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
  --color-brand-accent:    #CA8A04;

  /* Surface & borders */
  --color-surface:         #f5f7fa;
  --color-border:          #e2e8f0;

  /* Semantic */
  --color-positive:        #16a34a;
  --color-negative:        #DC2626;
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
  brandAccent:    '#CA8A04',  // Secondary: success, profit, chart secondary

  surface:        '#f5f7fa',
  border:         '#e2e8f0',
  positive:       '#16a34a',
  negative:       '#DC2626',
  warning:        '#f59e0b',

  // Chart palette — 6 colors for data series
  chart: ['#097cf7', '#CA8A04', '#1E3A8A', '#059669', '#DC2626', '#8b5cf6'],
} as const
```

### Streamlit Adaptation

Inject via `st.markdown()`:
```python
# utils/design.py
def inject_css(primary="#097cf7", secondary="#002151", accent="#CA8A04"):
    st.markdown(f"""<style>
    :root {{
        --brand-primary: {primary};
        --brand-secondary: {secondary};
        --brand-accent: {accent};
    }}
    .stMetric {{ border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }}
    .stMetric:hover {{ box-shadow: 0 4px 12px rgba(0,0,0,0.08); }}
    [data-testid="stSidebar"] {{ background: #f5f7fa; }}
    </style>""", unsafe_allow_html=True)
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

## Z-Layer System

Strict layering prevents overlap issues:

| Layer | Z-index | Element | CSS |
|-------|---------|---------|-----|
| Aurora background | 0 | `body::before` | `position: fixed; z-index: 0;` |
| Page content | 1 | Main content area | `position: relative; z-index: 1;` |
| Sticky KPI bar | 15 | Mini KPIs on scroll | `position: sticky; z-index: 15;` |
| Nav tabs | 20 | Tab navigation | `position: sticky; top: 56px; z-index: 20;` |
| Kai chat panel | 25 | Slide-out AI panel | `position: fixed; right: 0; z-index: 25;` |
| Header | 30 | Fixed top bar | `position: fixed; top: 0; z-index: 30;` |
| Modal / overlay | 40 | Dialogs, popovers | `position: fixed; z-index: 40;` |
| Loading screen | 50 | Full-screen loader | `position: fixed; z-index: 50;` |

---

## Aurora Mesh Gradient Background

Subtle animated ambient background. Goes on `body::before`:

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 60% at 0% -5%,
      rgba(var(--aurora-r), var(--aurora-g), var(--aurora-b), 0.14) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 100% 105%,
      rgba(202, 138, 4, 0.10) 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 45% 45%,
      rgba(30, 58, 138, 0.08) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
  animation: aurora-drift 25s ease-in-out infinite alternate;
}

@keyframes aurora-drift {
  0%   { transform: translate(0, 0) scale(1); }
  50%  { transform: translate(-15px, 10px) scale(1.02); }
  100% { transform: translate(20px, -15px) scale(0.98); }
}
```

The aurora colors should derive from the brand primary. Extract RGB values:
```css
/* For primary #097cf7 */
--aurora-r: 9;
--aurora-g: 124;
--aurora-b: 247;
```

---

## Glassmorphism

Semi-transparent backgrounds with blur. Used for header and navigation:

```css
.glass {
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  box-shadow: 0 1px 8px -2px rgba(9, 124, 247, 0.06),
              inset 0 -1px 0 rgba(255, 255, 255, 0.5);
}
```

The shadow color should use the brand primary with low opacity.

---

## Component Specifications

### Header

Fixed top bar, glassmorphism background, 56px height:

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
- `position: fixed; top: 0; width: 100%; z-index: 30;`

### NavTabs

Horizontal tabs below header, sticky on scroll:

```
┌──────────────────────────────────────────────────────────┐
│  [📊 Overview]  [👥 Users]  [📈 Trends]  [🤖 Assistant] │
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

### KPI Card

The core metric display component:

```
┌──────────────────────────────────────────────────────────┐
│  Revenue                                    [ℹ️ popover] │
│                                                          │
│  $1,234,567      ▲ 12.3%                   [sparkline]  │
│                  vs prior year                           │
│                                                          │
│  Sub-metric: $456,789 (+8.2%)                           │
└──────────────────────────────────────────────────────────┘
```

- **Label**: text-sm text-muted font-medium, top-left
- **Value**: text-2xl font-semibold font-mono, animated counter on mount
- **Delta badge**: Inline pill — `▲ 12.3%` green for positive, `▼ -5.2%` red for negative
- **Sparkline**: Tiny line chart (80x28px) right of value, area fill with gradient
- **Info popover**: `ℹ️` icon top-right, click shows definition tooltip
- **Card style**: `bg-white rounded-lg border border-border shadow-sm p-4`
- **Hover**: Subtle shadow lift `box-shadow: 0 4px 12px rgba(0,0,0,0.08)`
- **Accent**: Left border 3px colored by metric category

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

- `position: sticky; top: 100px; z-index: 15;` (below header + nav)
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

- Full viewport, `position: fixed; inset: 0; z-index: 50;`
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
    rgba(var(--aurora-r), var(--aurora-g), var(--aurora-b), 0.03) 0%,
    rgba(var(--aurora-r), var(--aurora-g), var(--aurora-b), 0.01) 100%);
}
```

Sort indicators: `▲` / `▼` appended to active column header.
Click row → navigate to detail page.

---

## ECharts Theme

Register once in providers/layout:

```typescript
import * as echarts from 'echarts'

export function registerAppTheme(colors: typeof COLORS) {
  echarts.registerTheme('app', {
    color: colors.chart,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' },
    title: { textStyle: { fontSize: 16, fontWeight: 600 } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
    line: { smooth: true, symbolSize: 6, lineStyle: { width: 2 } },
    categoryAxis: {
      axisLine: { lineStyle: { color: colors.border } },
      splitLine: { lineStyle: { color: colors.surface } },
    },
    valueAxis: {
      axisLine: { show: false },
      splitLine: { lineStyle: { color: colors.border } },
    },
    tooltip: {
      backgroundColor: '#fff',
      borderColor: colors.border,
      textStyle: { fontFamily: 'Plus Jakarta Sans' },
    },
  })
}
```

Use with: `<ReactECharts theme="app" option={...} />`

---

## Animations

### Card Stagger (Framer Motion)

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

### Section Fade-in

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

### Skeleton Shimmer (CSS)

```css
.skeleton-shimmer {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
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

---

## Spacing & Layout

| Element | Padding | Gap |
|---------|---------|-----|
| Page container | `px-6 py-4` | — |
| Card grid | — | `gap-4` |
| Between sections | — | `gap-6` (24px) |
| Card internal | `p-4` (compact) or `p-6` (featured) | — |
| KPI grid | 4 columns on desktop, 2 on tablet, 1 on mobile | `gap-4` |
| Chart container | `p-6` | — |

### Responsive Breakpoints

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

## Streamlit Design Notes

Streamlit has limited CSS control. Best achievable:

1. **Custom CSS injection** via `st.markdown('<style>...</style>', unsafe_allow_html=True)`
2. **Theme in `.streamlit/config.toml`**:
   ```toml
   [theme]
   primaryColor = "#097cf7"
   backgroundColor = "#ffffff"
   secondaryBackgroundColor = "#f5f7fa"
   textColor = "#000000"
   font = "sans serif"
   ```
3. **No aurora/glassmorphism** — use clean white/surface backgrounds
4. **No animated counters** — `st.metric()` shows static values with delta
5. **Charts**: Use Plotly with matching color sequence:
   ```python
   import plotly.io as pio
   pio.templates["keboola"] = go.layout.Template(
       layout=go.Layout(
           colorway=["#097cf7", "#CA8A04", "#1E3A8A", "#059669", "#DC2626", "#8b5cf6"],
           font=dict(family="Plus Jakarta Sans, sans-serif"),
       )
   )
   pio.templates.default = "keboola"
   ```
