# Design System — Charts
*Part of the Keboola Data App design system. See also: design-tokens.md, design-components.md*

**Contents:**
- [Aurora Mesh Gradient Background](#aurora-mesh-gradient-background)
- [Glassmorphism](#glassmorphism)
- [When to use ECharts vs Recharts](#when-to-use-echarts-vs-recharts)
- [ECharts Theme](#echarts-theme)
- [Recharts Setup Pattern](#recharts-setup-pattern)
- [Chart Responsive Heights](#chart-responsive-heights)

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
      rgba(9, 124, 247, 0.14) 0%, transparent 55%),
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

The aurora colors derive from the brand primary. The default uses hardcoded RGB values for simplicity. When rebranding, update the rgba values in the gradient to match the new primary color.

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

## When to use ECharts vs Recharts

| Criteria | ECharts | Recharts |
|----------|---------|----------|
| Chart variety | 50+ types (treemap, sankey, gauge, radar, funnel) | ~10 types (line, bar, area, pie, scatter, radar) |
| Data volume | Handles 100K+ points (canvas-based) | Best under 10K points (SVG-based) |
| API style | Config object `{ xAxis, yAxis, series }` | JSX components `<LineChart><Line /></LineChart>` |
| Theme support | Built-in `registerTheme()` with brand colors | Manual color props per component |
| Bundle size | ~800KB | ~300KB |
| Best for | Data-heavy dashboards, financial, analytics | Simple reports, marketing dashboards |

**Decision rule:** If the app needs more than line/bar/pie, or datasets > 10K rows, use ECharts. Otherwise, Recharts is simpler.

---

## ECharts Theme

Register once in providers/layout:

```typescript
import * as echarts from 'echarts'

export function registerKeboolaTheme(colors: typeof COLORS) {
  echarts.registerTheme('keboola', {
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

Use with: `<ReactECharts theme="keboola" option={...} />`

### Chart Y-Axis Rule — Always Start at 0

All bar, line, and area charts MUST start the Y-axis at 0. This prevents visual exaggeration of small differences.

**ECharts:**

```typescript
// CORRECT — scale: false forces Y-axis to include 0
yAxis: {
  type: 'value',
  scale: false,  // DEFAULT, but always set explicitly
  axisLabel: {
    formatter: (v: number) => formatCompact(v),
  },
},

// WRONG — scale: true lets ECharts auto-range, hiding the baseline
// yAxis: { type: 'value', scale: true }  // NEVER for bar/line/area
```

**Recharts:**

```tsx
{/* CORRECT — domain starts at 0 */}
<YAxis domain={[0, 'auto']} tickFormatter={formatCompact} />

{/* WRONG — omitting domain lets Recharts auto-scale */}
{/* <YAxis /> */}
```

**Exception:** Indexed or normalized data (e.g., index = 100 baseline) may use a non-zero origin. In this case, add a reference line at the baseline:

```typescript
// ECharts — indexed data exception
yAxis: { type: 'value', scale: true },
series: [{ markLine: { data: [{ yAxis: 100 }], label: { formatter: 'Baseline' } } }],
```

**Rules:**
- `scale: false` (ECharts) and `domain={[0, 'auto']}` (Recharts) are mandatory defaults
- Y-axis labels must use `formatCompact` from `lib/constants.ts` — never raw numbers
- If a chart must use non-zero origin, it requires an explicit comment explaining why

### Chart Tooltip Standards

Tooltips must be formatted, readable, and consistent across all charts.

**ECharts — custom tooltip formatter:**

```typescript
tooltip: {
  trigger: 'axis',           // 'axis' for line/bar, 'item' for pie/scatter
  axisPointer: {
    type: 'cross',           // Crosshair for line charts
    lineStyle: { color: '#cbd5e1', type: 'dashed' },
  },
  formatter: (params: any) => {
    const items = Array.isArray(params) ? params : [params]
    const header = `<div style="font-weight:600;margin-bottom:4px">${items[0].axisValueLabel}</div>`
    const rows = items.map((p: any) =>
      `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
        <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
        <span style="color:#64748b">${p.seriesName}:</span>
        <span style="font-weight:600;font-family:'JetBrains Mono',monospace">${formatCurrency(p.value)}</span>
      </div>`
    ).join('')
    return header + rows
  },
},
```

**Recharts — custom tooltip component:**

```tsx
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-brand-secondary mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-mono font-medium">{formatCompact(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Usage:
<Tooltip content={<ChartTooltip />} />
```

**Tooltip rules:**
- Category/date on the first line, bold
- Each series: colored dot + series name + formatted value
- Use `formatCompact` for currency values in tooltips (e.g., `$1.2M` not `$1,234,567`)
- Line charts: use crosshair (`axisPointer.type: 'cross'`); bar charts: use shadow (`type: 'shadow'`)
- Never use the default tooltip — always provide a custom formatter

---

## Recharts Setup Pattern

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { COLORS } from '@/lib/constants'

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis tick={{ fontSize: 12 }} />
    <Tooltip />
    <Line type="monotone" dataKey="revenue" stroke={COLORS.brandPrimary} strokeWidth={2} />
    <Line type="monotone" dataKey="previous" stroke={COLORS.brandSecondary} strokeWidth={2} strokeDasharray="5 5" />
  </LineChart>
</ResponsiveContainer>
```

#### Required Recharts YAxis Props

Every Recharts `<YAxis>` MUST include `domain` and `tickFormatter`. Every chart MUST use a custom tooltip.

```tsx
import { formatCompact, formatCurrency } from '@/lib/constants'

{/* YAxis — always start at 0, always format labels */}
<YAxis
  domain={[0, 'auto']}
  tickFormatter={formatCompact}
  tick={{ fontSize: 12 }}
  width={60}
/>

{/* Custom tooltip — required for all Recharts charts */}
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-brand-secondary mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-mono font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

{/* Usage */}
<ResponsiveContainer width="100%" height={400}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis domain={[0, 'auto']} tickFormatter={formatCompact} tick={{ fontSize: 12 }} width={60} />
    <Tooltip content={<ChartTooltip />} />
    <Line type="monotone" dataKey="revenue" stroke={COLORS.brandPrimary} strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

**Rules:**
- Never omit `domain` — Recharts may auto-scale away from 0 and exaggerate small changes
- Never use the default tooltip — always provide `<Tooltip content={<ChartTooltip />} />`
- `tickFormatter` must use `formatCompact` from `lib/constants.ts` — never inline `.toFixed()`
- Set `width={60}` on YAxis to prevent label clipping

---

## Chart Responsive Heights

Charts must adapt height to the viewport. Never use a fixed pixel height without responsive overrides.

| Breakpoint | Chart Height | KPI Sparkline |
|------------|-------------|---------------|
| Desktop (>1200px) | 400px | 80x28px |
| Tablet (768-1200px) | 320px | 64x24px |
| Mobile (<768px) | 240px | 56x20px |

**ECharts — resize handler:**

```tsx
'use client'
import { useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsInstance } from 'echarts-for-react'

function useChartResize(chartRef: React.RefObject<EChartsInstance | null>) {
  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.resize()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [chartRef])
}

// Usage:
function MyChart({ option }: { option: any }) {
  const chartRef = useRef<EChartsInstance | null>(null)
  useChartResize(chartRef)

  return (
    <div className="h-[240px] md:h-[320px] lg:h-[400px]">
      <ReactECharts
        ref={(e) => { chartRef.current = e?.getEchartsInstance() ?? null }}
        theme="keboola"
        option={option}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}
```

**Recharts — ResponsiveContainer:**

```tsx
{/* Recharts handles resize automatically via ResponsiveContainer */}
<div className="h-[240px] md:h-[320px] lg:h-[400px]">
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      {/* ... */}
    </LineChart>
  </ResponsiveContainer>
</div>
```

**Rules:**
- Always wrap charts in a responsive height container: `h-[240px] md:h-[320px] lg:h-[400px]`
- ECharts: call `.resize()` on window resize — ECharts uses canvas and does not auto-resize
- Recharts: always use `<ResponsiveContainer>` — never set width/height as props on the chart itself
- Never set chart height in the ECharts `option.grid` — let the container control height
