# Kai Chart Visualization

Automatic chart visualization for data tables in Kai responses. Every Kai-integrated app should include these patterns — they transform raw table data into interactive visualizations.

For base Kai integration, see `references/kai-core.md` and `references/kai-nextjs.md`.
For the custom dashboard (opt-in), see `references/kai-custom-dashboard.md`.

---

## Auto-Detect Numeric Data in Tables

When Kai returns a markdown table, detect if it contains numeric data and show a "View as chart" button.

```typescript
// lib/chart-detection.ts

interface TableData {
  headers: string[]
  rows: string[][]
  numericColumns: number[]  // indices of columns with numeric data
}

export function parseMarkdownTable(markdown: string): TableData | null {
  const lines = markdown.split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 3) return null  // need header + separator + at least 1 data row

  const parseRow = (line: string) =>
    line.split('|').filter(Boolean).map(cell => cell.trim())

  const headers = parseRow(lines[0])
  const rows = lines.slice(2).map(parseRow).filter(r => r.length === headers.length)

  if (rows.length < 2) return null  // need at least 2 data rows for a chart

  // Detect numeric columns (>50% of values are numbers)
  const numericColumns = headers.map((_, colIdx) => {
    const numericCount = rows.filter(row => {
      const val = row[colIdx]?.replace(/[$,%€£¥]/g, '').replace(/,/g, '').trim()
      return !isNaN(Number(val)) && val !== ''
    }).length
    return numericCount / rows.length > 0.5 ? colIdx : -1
  }).filter(idx => idx >= 0)

  if (numericColumns.length === 0) return null

  return { headers, rows, numericColumns }
}

export function hasChartableData(content: string): boolean {
  // Quick check: does the content contain a markdown table with numeric data?
  return content.includes('|') && parseMarkdownTable(content) !== null
}
```

---

## 10 Chart Types

| Type | ID | Best For | Library |
|------|-----|----------|---------|
| Vertical Bar | `bar` | Category comparison | ECharts |
| Horizontal Bar | `h-bar` | Many categories, long labels | ECharts |
| Line | `line` | Time series, trends | ECharts |
| Area | `area` | Volume over time | ECharts |
| Pie | `pie` | Part-of-whole (2-4 items) | ECharts |
| Stacked Bar | `stacked` | Composition comparison | ECharts |
| Radar | `radar` | Multi-dimensional comparison | ECharts |
| Scatter | `scatter` | Correlation, distribution | ECharts |
| Waterfall | `waterfall` | Sequential additions/subtractions | ECharts |
| Treemap | `treemap` | Hierarchical part-of-whole | ECharts |

---

## Smart Type Recommendation

Auto-select the best chart type based on data shape:

```typescript
// lib/chart-recommendation.ts
import type { TableData } from './chart-detection'

export type ChartType = 'bar' | 'h-bar' | 'line' | 'area' | 'pie' | 'stacked' | 'radar' | 'scatter' | 'waterfall' | 'treemap'

export function recommendChartType(data: TableData): ChartType {
  const { headers, rows, numericColumns } = data
  const categoryCol = headers.findIndex((_, i) => !numericColumns.includes(i))
  const rowCount = rows.length
  const numericCount = numericColumns.length

  // Check if first column looks like time series
  const isTimeSeries = categoryCol >= 0 && rows.every(row => {
    const val = row[categoryCol]
    return /\d{4}[-/]\d{2}/.test(val) || /Q[1-4]\s*\d{4}/.test(val) || /^\d{4}$/.test(val)
  })

  // Decision tree
  if (isTimeSeries && numericCount === 1) return 'line'
  if (isTimeSeries && numericCount > 1) return 'area'
  if (rowCount <= 4 && numericCount === 1) return 'pie'
  if (rowCount > 10) return 'h-bar'
  if (numericCount >= 4 && rowCount <= 8) return 'radar'
  if (numericCount === 2 && rowCount > 5) return 'scatter'
  if (numericCount > 1 && rowCount <= 10) return 'stacked'
  return 'bar'
}

export function getAllChartTypes(): { id: ChartType; label: string }[] {
  return [
    { id: 'bar', label: 'Bar' },
    { id: 'h-bar', label: 'H-Bar' },
    { id: 'line', label: 'Line' },
    { id: 'area', label: 'Area' },
    { id: 'pie', label: 'Pie' },
    { id: 'stacked', label: 'Stacked' },
    { id: 'radar', label: 'Radar' },
    { id: 'scatter', label: 'Scatter' },
    { id: 'waterfall', label: 'Waterfall' },
    { id: 'treemap', label: 'Treemap' },
  ]
}
```

---

## Chart Component

Renders any of the 10 chart types from parsed table data:

```typescript
// components/kai/KaiChart.tsx
'use client'

import { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { COLORS } from '@/lib/constants'
import type { TableData } from '@/lib/chart-detection'
import type { ChartType } from '@/lib/chart-recommendation'
import { recommendChartType, getAllChartTypes } from '@/lib/chart-recommendation'

interface Props {
  data: TableData
  initialType?: ChartType
}

export default function KaiChart({ data, initialType }: Props) {
  const recommended = useMemo(() => recommendChartType(data), [data])
  const [chartType, setChartType] = useState<ChartType>(initialType || recommended)

  const option = useMemo(() => buildChartOption(data, chartType), [data, chartType])

  return (
    <div className="mt-3 border border-border rounded-xl overflow-hidden bg-white">
      {/* Chart */}
      <div className="p-4">
        <ReactECharts option={option} theme="app" style={{ height: 320 }} />
      </div>

      {/* Chart type picker */}
      <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">
        {getAllChartTypes().map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setChartType(id)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              chartType === id
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-white text-muted-foreground border-border hover:border-brand-primary/40'
            }`}
          >
            {label}{id === recommended ? ' *' : ''}
          </button>
        ))}
      </div>
    </div>
  )
}

function buildChartOption(data: TableData, type: ChartType): any {
  const { headers, rows, numericColumns } = data
  const categoryCol = headers.findIndex((_, i) => !numericColumns.includes(i))
  const categories = categoryCol >= 0 ? rows.map(r => r[categoryCol]) : rows.map((_, i) => `Row ${i + 1}`)

  const parseNum = (val: string) => Number(val?.replace(/[$,%€£¥,]/g, '').trim()) || 0

  const series = numericColumns.map((colIdx, seriesIdx) => ({
    name: headers[colIdx],
    data: rows.map(r => parseNum(r[colIdx])),
    color: COLORS.chart[seriesIdx % COLORS.chart.length],
  }))

  switch (type) {
    case 'bar':
      return {
        xAxis: { type: 'category', data: categories },
        yAxis: { type: 'value' },
        series: series.map(s => ({ ...s, type: 'bar' })),
        tooltip: { trigger: 'axis' },
      }
    case 'h-bar':
      return {
        yAxis: { type: 'category', data: categories },
        xAxis: { type: 'value' },
        series: series.map(s => ({ ...s, type: 'bar' })),
        tooltip: { trigger: 'axis' },
      }
    case 'line':
      return {
        xAxis: { type: 'category', data: categories },
        yAxis: { type: 'value' },
        series: series.map(s => ({ ...s, type: 'line', smooth: true })),
        tooltip: { trigger: 'axis' },
      }
    case 'area':
      return {
        xAxis: { type: 'category', data: categories },
        yAxis: { type: 'value' },
        series: series.map(s => ({ ...s, type: 'line', smooth: true, areaStyle: { opacity: 0.15 } })),
        tooltip: { trigger: 'axis' },
      }
    case 'pie':
      return {
        series: [{
          type: 'pie', radius: ['35%', '70%'],
          data: categories.map((name, i) => ({ name, value: series[0]?.data[i] || 0 })),
          label: { show: true, formatter: '{b}: {d}%' },
        }],
        tooltip: { trigger: 'item' },
      }
    case 'stacked':
      return {
        xAxis: { type: 'category', data: categories },
        yAxis: { type: 'value' },
        series: series.map(s => ({ ...s, type: 'bar', stack: 'total' })),
        tooltip: { trigger: 'axis' },
      }
    case 'radar':
      return {
        radar: { indicator: categories.map(name => ({ name, max: Math.max(...series.flatMap(s => s.data)) * 1.2 })) },
        series: [{ type: 'radar', data: series.map(s => ({ name: s.name, value: s.data })) }],
        tooltip: {},
      }
    case 'scatter':
      return {
        xAxis: { type: 'value', name: series[0]?.name },
        yAxis: { type: 'value', name: series[1]?.name },
        series: [{ type: 'scatter', data: rows.map(r => [parseNum(r[numericColumns[0]]), parseNum(r[numericColumns[1] || numericColumns[0]])]) }],
        tooltip: { trigger: 'item' },
      }
    case 'waterfall':
      return {
        xAxis: { type: 'category', data: categories },
        yAxis: { type: 'value' },
        series: [{
          type: 'bar', stack: 'waterfall',
          data: (() => {
            const vals = series[0]?.data || []
            let cumulative = 0
            return vals.map(v => { const prev = cumulative; cumulative += v; return { value: v, itemStyle: { color: v >= 0 ? COLORS.positive : COLORS.negative } } })
          })(),
        }],
        tooltip: { trigger: 'axis' },
      }
    case 'treemap':
      return {
        series: [{
          type: 'treemap',
          data: categories.map((name, i) => ({ name, value: series[0]?.data[i] || 0 })),
        }],
        tooltip: { trigger: 'item' },
      }
    default:
      return {}
  }
}
```

---

## Fullscreen Chart Modal

Expand any chart to full screen with a chart type picker and PNG export:

```typescript
// components/kai/ChartModal.tsx
'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactECharts from 'echarts-for-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  option: any
  chartType: string
  onChangeType: (type: string) => void
  allTypes: { id: string; label: string }[]
  recommended: string
}

export default function ChartModal({ isOpen, onClose, option, chartType, onChangeType, allTypes, recommended }: Props) {
  const chartRef = useRef<any>(null)

  function exportPng() {
    const instance = chartRef.current?.getEchartsInstance()
    if (!instance) return
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
    const a = document.createElement('a')
    a.href = url
    a.download = 'kai-chart.png'
    a.click()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2 flex-wrap">
                {allTypes.map(({ id, label }) => (
                  <button key={id} onClick={() => onChangeType(id)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      chartType === id ? 'bg-brand-primary text-white border-brand-primary' : 'border-border hover:border-brand-primary/40'
                    }`}>
                    {label}{id === recommended ? ' *' : ''}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportPng} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-surface">PNG</button>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface">✕</button>
              </div>
            </div>
            {/* Chart */}
            <div className="flex-1 p-6">
              <ReactECharts ref={chartRef} option={option} theme="app" style={{ height: '100%', minHeight: 400 }} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
```

---

## CSV Export

"CSV" button on every Kai table:

```typescript
// lib/csv-export.ts
import type { TableData } from './chart-detection'

export function exportTableAsCsv(data: TableData, filename = 'kai-data.csv') {
  const csvRows = [
    data.headers.join(','),
    ...data.rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}
```

---

## Pin to Dashboard

Save chart data + config to localStorage for the custom dashboard:

```typescript
// lib/dashboard-pins.ts
const PINS_KEY = 'kai-dashboard-pins'

export interface PinnedChart {
  id: string
  title: string
  data: TableData
  chartType: ChartType
  pinnedAt: number
  dashboardId?: string
}

export function pinChart(pin: PinnedChart) {
  const pins = getPinnedCharts()
  pins.push(pin)
  localStorage.setItem(PINS_KEY, JSON.stringify(pins))
  window.dispatchEvent(new CustomEvent('kai-pins-changed'))
}

export function getPinnedCharts(): PinnedChart[] {
  try { return JSON.parse(localStorage.getItem(PINS_KEY) || '[]') }
  catch { return [] }
}

export function removePinnedChart(id: string) {
  const pins = getPinnedCharts().filter(p => p.id !== id)
  localStorage.setItem(PINS_KEY, JSON.stringify(pins))
  window.dispatchEvent(new CustomEvent('kai-pins-changed'))
}
```

Add a "Pin" button next to the chart type picker and CSV/fullscreen buttons:
```typescript
<button onClick={() => pinChart({
  id: crypto.randomUUID(),
  title: `Chart: ${data.headers[0]}`,
  data,
  chartType,
  pinnedAt: Date.now(),
})}
  className="px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-surface">
  Pin
</button>
```

---

## Integration in ChatMessage

Wrap the markdown table detection into the chat message renderer:

```typescript
// In ChatMessage component, after rendering markdown:
{hasChartableData(message.content) && (
  <div className="mt-2 flex gap-2">
    <button onClick={() => setShowChart(true)}
      className="text-xs text-brand-primary hover:underline">
      View as chart
    </button>
    <button onClick={() => exportTableAsCsv(parseMarkdownTable(message.content)!)}
      className="text-xs text-muted-foreground hover:text-brand-primary">
      CSV
    </button>
  </div>
)}
{showChart && tableData && (
  <KaiChart data={tableData} />
)}
```
