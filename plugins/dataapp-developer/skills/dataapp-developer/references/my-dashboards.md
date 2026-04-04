# My Dashboards — Custom Dashboard Builder

Reference implementation for the **My Dashboards** feature — a client-side chart builder with drag/resize free-form canvas. Full chart builder with drag/drop field wells, chart library, multi-dashboard tabs, magnetic snap, collision detection, PNG/PDF export. Required in **every** generated app.

---

## What It Does

- User selects a data source, dimensions, and measures from the sidebar
- Preview renders live; user saves the chart to a named dashboard
- Saved chart appears on the canvas as a draggable/resizable card
- Multiple named dashboards supported (tabs)
- All state is localStorage only — no backend persistence
- Export to PNG or PDF via `html2canvas-pro`
- **KAI integration:** Charts can be pinned from AI Assistant conversations via KaiTableChart component

---

## New npm Packages

Add to `frontend/package.json`:

```json
"react-draggable": "^4.4.0",
"react-resizable": "^3.0.5",
"@dnd-kit/core": "^6.1.0",
"@dnd-kit/sortable": "^7.0.0",
"@dnd-kit/utilities": "^3.2.2",
"html2canvas-pro": "^1.5.8"
```

Also add TypeScript type for resizable: `"@types/react-resizable": "^3.0.0"` (devDependencies).

Also requires (should already be in template): `echarts-for-react`, `echarts`, `framer-motion`, `lucide-react`

---

## New Files to Create

```
frontend/
├── lib/
│   ├── dashboard-storage.ts         ← localStorage CRUD for dashboards + charts
│   ├── chart-config-storage.ts      ← localStorage for saved chart configs (chart library)
│   └── chart-utils.ts               ← buildOption() ECharts adapter
├── components/
│   └── kai/
│       └── KaiTableChart.tsx        ← Wraps markdown tables with Pin/Chart/CSV buttons
└── app/(dashboard)/
    └── custom/
        ├── page.tsx                 ← Main dashboard canvas page
        ├── ChartBuilderSidebar.tsx  ← Slide-in sidebar: builder + library tabs
        └── chart-builder/
            ├── DraggableField.tsx   ← Draggable field pill from source list
            ├── FieldWell.tsx        ← Drop target well (Axis / Values)
            └── SortableFieldChip.tsx ← Sortable chip inside FieldWell
```

---

## Files to Update

- `frontend/lib/api.ts` — add `useDataSchema()` and `useQueryData()` hooks
- `frontend/components/layout/NavTabs.tsx` — add **"My Dashboards"** tab → `/custom`
- `backend/routers/query.py` — add `/api/data-schema` and `/api/query-data` endpoints
- `backend/main.py` — register `query.router`
- `frontend/app/(dashboard)/custom/page.tsx` — if seeding demo charts, adapt `buildSeedCharts()` to use app-specific data

---

## Adaptation Required (per app)

### 1. `lib/chart-config-storage.ts` — `DataSource` type
Replace the hardcoded union type and `Period` type with the app's actual table short_names from the Build Brief:
```typescript
// Replace with app's actual table short_names
export type DataSource = 'table_a' | 'table_b' | ...
```

### 2. `backend/routers/query.py` — `SCHEMA` and `DATA_SCHEMA_RESPONSE`
**This is the most critical adaptation.** For each table in TABLE_IDS:
- Identify which columns are dimensions (categorical / date) vs measures (numeric)
- For measures: use `"sum"` for flow values (revenue, count, costs) and `"mean"` for rates/ratios (percentage, average)
- `date_col`: the date column name if the table has one (for period filtering), or `None`
- `supports_period`: `True` if table has a date column

### 3. `ChartBuilderSidebar.tsx` — `SOURCE_LABELS` and `SOURCE_BADGE_COLORS`
Update `SOURCE_LABELS` and `SOURCE_BADGE_COLORS` to match `DataSource` values:
```typescript
const SOURCE_LABELS: Record<DataSource, string> = {
  table_a: 'Human-readable name',
  ...
}
```

---

## `lib/dashboard-storage.ts`

Copy verbatim — no adaptation needed:

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { AnyDashboardChart, DashboardChart } from './chart-config-storage'

export type { AnyDashboardChart, DashboardChart } from './chart-config-storage'

export interface PinnedChart {
  id: string
  title: string
  headers: string[]
  rows: string[][]
  chartType: string
  pinnedAt: string
  sourceQuestion: string
  type?: 'static'
  x: number; y: number; w: number; h: number
}

export interface Dashboard {
  id: string
  name: string
  charts: AnyDashboardChart[]
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'demo-dashboards'
const ACTIVE_KEY = 'demo-active-dashboard'
const SEEDED_KEY = 'demo-dashboard-seeded'
const CHANGE_EVENT = 'demo-dashboards-changed'
const MAX_CHARTS = 20
const MAX_DASHBOARDS = 10

function readAll(): Dashboard[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) { const parsed: unknown = JSON.parse(stored); if (Array.isArray(parsed)) return parsed as Dashboard[] }
  } catch { /* corrupt */ }
  return []
}

function writeAll(dashboards: Dashboard[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

function getOrCreateDefault(): Dashboard[] {
  if (typeof window === 'undefined') return []
  const all = readAll()
  if (all.length === 0) {
    const def: Dashboard = { id: crypto.randomUUID(), name: 'My Dashboard', charts: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    writeAll([def]); localStorage.setItem(ACTIVE_KEY, def.id); return [def]
  }
  return all
}

export function getActiveDashboardId(): string {
  if (typeof window === 'undefined') return ''
  const all = getOrCreateDefault(); if (all.length === 0) return ''
  const stored = localStorage.getItem(ACTIVE_KEY)
  if (stored && all.some((d) => d.id === stored)) return stored
  return all[0].id
}

export function setActiveDashboardId(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_KEY, id); window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

export function createDashboard(name: string): string {
  const all = getOrCreateDefault(); if (all.length >= MAX_DASHBOARDS) return all[0].id
  const db: Dashboard = { id: crypto.randomUUID(), name, charts: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  all.push(db); writeAll(all); setActiveDashboardId(db.id); return db.id
}

export function renameDashboard(id: string, name: string): void {
  const all = getOrCreateDefault(); const db = all.find((d) => d.id === id)
  if (db) { db.name = name; db.updatedAt = new Date().toISOString(); writeAll(all) }
}

export function deleteDashboard(id: string): void {
  let all = readAll().filter((d) => d.id !== id)
  if (all.length === 0) all = [{ id: crypto.randomUUID(), name: 'My Dashboard', charts: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
  writeAll(all); if (getActiveDashboardId() === id) setActiveDashboardId(all[0].id)
}

export function pinChart(chart: Omit<PinnedChart, 'id' | 'pinnedAt' | 'x' | 'y' | 'w' | 'h'>, dashboardId?: string): void {
  const all = getOrCreateDefault(); const dbId = dashboardId ?? getActiveDashboardId(); const db = all.find((d) => d.id === dbId)
  if (!db || db.charts.length >= MAX_CHARTS) return
  const maxY = db.charts.reduce((max, c) => Math.max(max, c.y + c.h), 0)
  db.charts.push({ ...chart, id: crypto.randomUUID(), pinnedAt: new Date().toISOString(), x: 0, y: maxY, w: 600, h: 300 })
  db.updatedAt = new Date().toISOString(); writeAll(all)
}

export function unpinChart(chartId: string): void {
  const all = getOrCreateDefault()
  for (const db of all) {
    const idx = db.charts.findIndex((c) => c.id === chartId)
    if (idx >= 0) { db.charts.splice(idx, 1); db.updatedAt = new Date().toISOString(); writeAll(all); return }
  }
}

export function addDynamicChart(configId: string, dashboardId?: string): void {
  const all = getOrCreateDefault(); const dbId = dashboardId || getActiveDashboardId(); const db = all.find((d) => d.id === dbId)
  if (!db || db.charts.length >= MAX_CHARTS) return
  const maxY = db.charts.reduce((max, c) => Math.max(max, c.y + c.h), 0)
  const chart: DashboardChart = { id: crypto.randomUUID(), type: 'dynamic', configId, x: 0, y: maxY, w: 600, h: 300, pinnedAt: new Date().toISOString() }
  db.charts.push(chart); db.updatedAt = new Date().toISOString(); writeAll(all)
}

export function updateChartTitle(chartId: string, title: string): void {
  const all = getOrCreateDefault()
  for (const db of all) {
    const chart = db.charts.find((c) => c.id === chartId)
    if (chart && 'title' in chart) { (chart as PinnedChart).title = title; db.updatedAt = new Date().toISOString(); writeAll(all); return }
  }
}

export function updateChartType(chartId: string, chartType: string): void {
  const all = getOrCreateDefault()
  for (const db of all) {
    const chart = db.charts.find((c) => c.id === chartId)
    if (chart && 'chartType' in chart) { (chart as PinnedChart).chartType = chartType; db.updatedAt = new Date().toISOString(); writeAll(all); return }
  }
}

export function updateAllLayouts(dashboardId: string, layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>): void {
  const all = getOrCreateDefault(); const db = all.find((d) => d.id === dashboardId); if (!db) return
  for (const l of layouts) { const chart = db.charts.find((c) => c.id === l.i); if (chart) { chart.x = l.x; chart.y = l.y; chart.w = l.w; chart.h = l.h } }
  db.updatedAt = new Date().toISOString(); writeAll(all)
}

export function isDashboardSeeded(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SEEDED_KEY) === '1'
}

export function markDashboardSeeded(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SEEDED_KEY, '1')
}

export function seedDemoCharts(charts: Omit<PinnedChart, 'pinnedAt'>[]): void {
  const all = getOrCreateDefault(); const dbId = getActiveDashboardId(); const db = all.find((d) => d.id === dbId) ?? all[0]; if (!db) return
  db.charts = charts.map((c) => ({ ...c, pinnedAt: new Date().toISOString() }))
  db.updatedAt = new Date().toISOString(); writeAll(all); markDashboardSeeded()
}

export function useDashboards(): Dashboard[] {
  const [dbs, setDbs] = useState<Dashboard[]>([])
  useEffect(() => {
    setDbs(getOrCreateDefault())
    const handler = () => setDbs(getOrCreateDefault())
    window.addEventListener(CHANGE_EVENT, handler); window.addEventListener('storage', handler)
    return () => { window.removeEventListener(CHANGE_EVENT, handler); window.removeEventListener('storage', handler) }
  }, [])
  return dbs
}

export function usePinnedCharts(): PinnedChart[] {
  const dbs = useDashboards()
  const activeId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_KEY) : null
  const db = dbs.find((d) => d.id === activeId) ?? dbs[0]
  return (db?.charts ?? []).filter((c): c is PinnedChart => !('configId' in c))
}
```

---

## `lib/chart-config-storage.ts`

Copy, then **replace `DataSource`** with app's actual table short_names:

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { ChartType } from './chart-utils'

// ADAPT: replace with app's actual table short_names from Build Brief
export type DataSource = 'table_a' | 'table_b'
export type Period = 'L3M' | 'L6M' | 'YTD' | '12M'

export interface ChartConfig {
  id: string; name: string; source: DataSource; dimension: string; measures: string[]
  period: Period | null; chartType: ChartType; createdAt: string; updatedAt: string
}

export interface DashboardChart {
  id: string; type: 'dynamic'; configId: string
  x: number; y: number; w: number; h: number; pinnedAt: string
}

export type AnyDashboardChart = import('./dashboard-storage').PinnedChart | DashboardChart

export interface ChartLibrary { configs: ChartConfig[] }

const LIBRARY_KEY = 'demo-chart-library'
const CHANGE_EVENT = 'demo-chart-library-changed'
const MAX_CONFIGS = 50

function readLibrary(): ChartLibrary {
  if (typeof window === 'undefined') return { configs: [] }
  try {
    const stored = localStorage.getItem(LIBRARY_KEY)
    if (stored) { const parsed: unknown = JSON.parse(stored); if (parsed && typeof parsed === 'object' && 'configs' in parsed) return parsed as ChartLibrary }
  } catch { /* corrupt */ }
  return { configs: [] }
}

function writeLibrary(library: ChartLibrary): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

export function getLibrary(): ChartLibrary { return readLibrary() }

export function saveConfig(config: Omit<ChartConfig, 'id' | 'createdAt' | 'updatedAt'>): ChartConfig {
  const library = readLibrary()
  if (library.configs.length >= MAX_CONFIGS) library.configs.shift()
  const now = new Date().toISOString()
  const newConfig: ChartConfig = { ...config, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
  library.configs.push(newConfig); writeLibrary(library); return newConfig
}

export function updateConfig(id: string, updates: Partial<Omit<ChartConfig, 'id' | 'createdAt'>>): void {
  const library = readLibrary(); const config = library.configs.find((c) => c.id === id); if (!config) return
  Object.assign(config, updates, { updatedAt: new Date().toISOString() }); writeLibrary(library)
}

export function deleteConfig(id: string): void {
  const library = readLibrary(); library.configs = library.configs.filter((c) => c.id !== id); writeLibrary(library)
}

export function useChartLibrary(): ChartConfig[] {
  const [configs, setConfigs] = useState<ChartConfig[]>([])
  useEffect(() => {
    setConfigs(readLibrary().configs)
    const handler = () => setConfigs(readLibrary().configs)
    window.addEventListener(CHANGE_EVENT, handler); window.addEventListener('storage', handler)
    return () => { window.removeEventListener(CHANGE_EVENT, handler); window.removeEventListener('storage', handler) }
  }, [])
  return configs
}
```

---

## `lib/chart-utils.ts`

Copy verbatim — uses COLORS from constants.ts which is already app-specific:

```typescript
import { COLORS } from '@/lib/constants'

export const C = [...COLORS.chart, '#f97316', '#06b6d4', '#ec4899', '#1e3a8a']
export const TYPES = ['bar', 'line', 'area', 'pie', 'horizontal-bar', 'stacked-bar']
export type ChartType = (typeof TYPES)[number]

export function parseNumber(s: string): number | null {
  const cleaned = s.replace(/[$,%€£¥]/g, '').replace(/,/g, '').trim()
  const n = Number(cleaned); return isNaN(n) ? null : n
}

export function buildOption(headers: string[], rows: string[][], chartType: ChartType, fs: boolean): object | null {
  const numericCols = headers.slice(1).map((_, i) => rows.every((r) => parseNumber(r[i + 1] ?? '') !== null))
  const labels = rows.map((r) => r[0])
  const series = headers.slice(1)
    .map((name, i) => numericCols[i] ? { name, values: rows.map((r) => parseNumber(r[i + 1] ?? '') ?? 0) } : null)
    .filter((s): s is { name: string; values: number[] } => s !== null)
  if (series.length === 0) return null

  const f = fs ? 13 : 10
  const g = fs ? { left: 80, right: 32, top: 40, bottom: 56 } : { left: 48, right: 8, top: 12, bottom: 28 }
  if (series.length > 1) g.bottom += 20

  if (chartType === 'pie') {
    return {
      tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: f } }, color: C,
      series: [{ type: 'pie' as const, radius: ['32%', '62%'], center: ['50%', '45%'],
        data: labels.map((name, i) => ({ name, value: series[0]?.values[i] ?? 0 })),
        label: { fontSize: f }, itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 } }],
    }
  }

  const isH = chartType === 'horizontal-bar', isLine = chartType === 'line' || chartType === 'area', isStacked = chartType === 'stacked-bar'
  const catData = isH ? [...labels].reverse() : labels
  const catAxis = { type: 'category' as const, data: catData, axisLabel: { fontSize: f, rotate: !isH && labels.length > 5 ? 25 : 0 } }
  const valAxis = { type: 'value' as const, scale: false, axisLabel: { fontSize: f }, splitLine: { lineStyle: { color: 'rgba(0,33,81,0.06)' } } }

  return {
    tooltip: { trigger: 'axis' as const },
    legend: series.length > 1 ? { bottom: 0, textStyle: { fontSize: f } } : undefined,
    color: C, grid: g,
    xAxis: isH ? valAxis : catAxis, yAxis: isH ? catAxis : valAxis,
    series: series.map((s, i) => ({
      name: s.name, type: (isLine ? 'line' : 'bar') as 'line' | 'bar',
      data: isH ? [...s.values].reverse() : s.values,
      stack: isStacked ? 'total' : undefined, smooth: isLine,
      itemStyle: { borderRadius: !isLine ? (isH ? [0, 4, 4, 0] : [4, 4, 0, 0]) : undefined, color: C[i % C.length] },
      areaStyle: chartType === 'area' ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: C[i % C.length] + '25' }, { offset: 1, color: C[i % C.length] + '00' }] } } : undefined,
    })),
  }
}
```

---

## KAI Chat Integration

## `components/kai/KaiTableChart.tsx`

Wraps markdown `<table>` elements rendered by KAI responses. Extracts headers + rows from React children, provides:
- **Always visible:** CSV export button + Pin button (pins to active dashboard)
- **If numeric data detected:** Chart toggle, chart type picker, fullscreen modal

```typescript
'use client'

import { useState, useRef, Children, isValidElement, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, X, Maximize2, Download, FileSpreadsheet, Pin } from 'lucide-react'
import { pinChart } from '@/lib/dashboard-storage'
import ReactECharts from 'echarts-for-react'
import type { ReactNode } from 'react'

// -- Extract table data from React children --

interface WithChildren { children?: ReactNode }
function getProps(el: React.ReactElement): WithChildren {
  return (el as React.ReactElement<WithChildren>).props
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (isValidElement(node)) { const c = getProps(node).children; if (c) return extractText(c) }
  if (Array.isArray(node)) return node.map(extractText).join('')
  return ''
}

function extractTableData(children: ReactNode): { headers: string[]; rows: string[][] } | null {
  const headers: string[] = []
  const rows: string[][] = []
  Children.forEach(children, child => {
    if (!isValidElement(child)) return
    const tag = typeof child.type === 'string' ? child.type : ''
    if (tag === 'thead') {
      Children.forEach(getProps(child).children, tr => {
        if (!isValidElement(tr)) return
        Children.forEach(getProps(tr).children, th => {
          if (isValidElement(th)) headers.push(extractText(getProps(th).children).trim())
        })
      })
    }
    if (tag === 'tbody') {
      Children.forEach(getProps(child).children, tr => {
        if (!isValidElement(tr)) return
        const row: string[] = []
        Children.forEach(getProps(tr).children, td => {
          if (isValidElement(td)) row.push(extractText(getProps(td).children).trim())
        })
        if (row.length > 0) rows.push(row)
      })
    }
  })
  if (headers.length < 2 || rows.length < 1) return null
  return { headers, rows }
}

function parseNumber(s: string): number | null {
  const cleaned = s.replace(/[$,%\u20ac\u00a3\u00a5]/g, '').replace(/,/g, '').trim()
  const n = Number(cleaned)
  return isNaN(n) ? null : n
}

// -- Chart types & auto-recommendation --

type ChartType = 'bar' | 'horizontal-bar' | 'line' | 'area' | 'pie' | 'stacked-bar' | 'radar' | 'scatter' | 'waterfall' | 'treemap'

interface ChartOption {
  type: ChartType
  label: string
  icon: string
  recommended?: boolean
}

function getAvailableCharts(headers: string[], rows: string[][], numericColCount: number): ChartOption[] {
  const labelCol = headers[0].toLowerCase()
  const rowCount = rows.length
  const hasTime = /year|month|quarter|period|date|time|fy\d/i.test(labelCol)
  const hasPct = headers.slice(1).some(h => /%|percent|margin|ratio|share|gp/i.test(h))
  const multiSeries = numericColCount > 1

  const charts: ChartOption[] = []
  charts.push({ type: 'bar', label: 'Bar', icon: '|' })
  charts.push({ type: 'horizontal-bar', label: 'H-Bar', icon: '=' })
  if (rowCount >= 3) {
    charts.push({ type: 'line', label: 'Line', icon: '~' })
    charts.push({ type: 'area', label: 'Area', icon: '\u25b2' })
  }
  if (numericColCount === 1 && rowCount >= 2 && rowCount <= 4)
    charts.push({ type: 'pie', label: 'Pie', icon: '\u25d4' })
  if (multiSeries)
    charts.push({ type: 'stacked-bar', label: 'Stacked', icon: '\u2590' })
  if (multiSeries && numericColCount >= 3 && rowCount <= 12)
    charts.push({ type: 'radar', label: 'Radar', icon: '\u25c7' })
  if (multiSeries && numericColCount === 2 && rowCount >= 3)
    charts.push({ type: 'scatter', label: 'Scatter', icon: '\u00b7' })
  if (numericColCount === 1 && rowCount >= 3 && rowCount <= 12)
    charts.push({ type: 'waterfall', label: 'Waterfall', icon: '\u229e' })
  if (numericColCount === 1 && rowCount >= 3 && rowCount <= 20)
    charts.push({ type: 'treemap', label: 'Treemap', icon: '\u25a6' })

  let recType: ChartType = 'bar'
  if (hasTime && rowCount >= 3) recType = 'line'
  else if (numericColCount === 1 && rowCount >= 2 && rowCount <= 4) recType = 'pie'
  else if (rowCount > 6 || hasPct) recType = 'horizontal-bar'
  else if (multiSeries && rowCount <= 6) recType = 'stacked-bar'

  return charts.map(c => ({ ...c, recommended: c.type === recType }))
}

// -- Colors -- import from lib/constants.ts (see design-tokens.md)
// CUSTOMIZE: Use the chart palette from Build Brief, defined in COLORS.chart in lib/constants.ts.
// Extended to 10 colors for KAI charts (standard dashboard uses 6):
// import { COLORS } from '@/lib/constants'
// const C = [...COLORS.chart, '#f97316', '#06b6d4', '#ec4899', '#1E3A8A']

// -- ECharts option builder (extended for KAI with radar, scatter, waterfall, treemap) --

function buildOption(headers: string[], rows: string[][], chartType: ChartType, fs: boolean) {
  const numericCols = headers.slice(1).map((_, i) => rows.every(r => parseNumber(r[i + 1] ?? '') !== null))
  const labels = rows.map(r => r[0])
  const series = headers.slice(1)
    .map((name, i) => numericCols[i] ? { name, values: rows.map(r => parseNumber(r[i + 1] ?? '') ?? 0) } : null)
    .filter((s): s is { name: string; values: number[] } => s !== null)
  if (series.length === 0) return null

  const f = fs ? 13 : 10
  const g = fs ? { left: 80, right: 32, top: 40, bottom: 56 } : { left: 56, right: 12, top: 16, bottom: 36 }
  if (series.length > 1) g.bottom += 24

  if (chartType === 'pie') {
    return {
      tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: f } }, color: C,
      series: [{ type: 'pie' as const, radius: ['32%', '62%'], center: ['50%', '45%'],
        data: labels.map((name, i) => ({ name, value: series[0].values[i] })),
        label: { fontSize: f }, itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 } }],
    }
  }

  if (chartType === 'radar') {
    const max = Math.max(...series.flatMap(s => s.values)) * 1.2
    return {
      tooltip: {}, legend: { bottom: 0, textStyle: { fontSize: f } }, color: C,
      radar: { indicator: labels.map(name => ({ name, max })), shape: 'polygon' as const },
      series: [{ type: 'radar' as const, data: series.map((s, i) => ({
        name: s.name, value: s.values, areaStyle: { opacity: 0.15 },
        lineStyle: { width: 2, color: C[i % C.length] }, itemStyle: { color: C[i % C.length] },
      })) }],
    }
  }

  if (chartType === 'scatter' && series.length >= 2) {
    return {
      tooltip: { trigger: 'item' as const }, color: C, grid: g,
      xAxis: { type: 'value' as const, name: series[0].name, axisLabel: { fontSize: f } },
      yAxis: { type: 'value' as const, name: series[1].name, axisLabel: { fontSize: f } },
      series: [{ type: 'scatter' as const, symbolSize: fs ? 14 : 10,
        data: labels.map((name, i) => ({ name, value: [series[0].values[i], series[1].values[i]] })) }],
    }
  }

  if (chartType === 'waterfall') {
    const vals = series[0].values
    const helper: number[] = []; let running = 0
    for (const v of vals) { helper.push(running); running += v }
    return {
      tooltip: { trigger: 'axis' as const }, color: C, grid: g,
      xAxis: { type: 'category' as const, data: labels, axisLabel: { fontSize: f } },
      yAxis: { type: 'value' as const, axisLabel: { fontSize: f } },
      series: [
        { type: 'bar' as const, stack: 'wf', data: helper, itemStyle: { color: 'transparent' } },
        { type: 'bar' as const, stack: 'wf', data: vals.map(v => ({ value: v, itemStyle: { color: v >= 0 ? '#16a34a' : '#DC2626', borderRadius: v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } })) },
      ],
    }
  }

  if (chartType === 'treemap') {
    return {
      color: C, series: [{ type: 'treemap' as const, breadcrumb: { show: false },
        data: labels.map((name, i) => ({ name, value: Math.abs(series[0].values[i]) })),
        label: { fontSize: fs ? 14 : 11, fontWeight: 600 as const, formatter: '{b}\n{c}' } }],
    }
  }

  const isH = chartType === 'horizontal-bar'
  const isLine = chartType === 'line' || chartType === 'area'
  const isStacked = chartType === 'stacked-bar'
  const catData = isH ? [...labels].reverse() : labels
  const catAxis = { type: 'category' as const, data: catData, axisLabel: { fontSize: f, rotate: !isH && labels.length > 5 ? 25 : 0 } }
  const valAxis = { type: 'value' as const, axisLabel: { fontSize: f }, splitLine: { lineStyle: { color: 'rgba(0,33,81,0.06)' } } }

  return {
    tooltip: { trigger: 'axis' as const },
    legend: series.length > 1 ? { bottom: 0, textStyle: { fontSize: f } } : undefined,
    color: C, grid: g,
    xAxis: isH ? valAxis : catAxis, yAxis: isH ? catAxis : valAxis,
    series: series.map((s, i) => ({
      name: s.name, type: (isLine ? 'line' : 'bar') as 'line' | 'bar',
      data: isH ? [...s.values].reverse() : s.values,
      stack: isStacked ? 'total' : undefined, smooth: isLine,
      itemStyle: { borderRadius: !isLine ? (isH ? [0, 4, 4, 0] : [4, 4, 0, 0]) : undefined, color: C[i % C.length] },
      areaStyle: chartType === 'area' ? { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: C[i % C.length] + '25' }, { offset: 1, color: C[i % C.length] + '00' }] } } : undefined,
    })),
  }
}

const buildChartOption = (headers: string[], rows: string[][], chartType: string) =>
  buildOption(headers, rows, chartType as ChartType, false)

// -- CSV export --

function exportCsv(headers: string[], rows: string[][]) {
  const escape = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'kai-data.csv'; a.click()
  URL.revokeObjectURL(url)
}

// -- Main component --

export default function KaiTableChart({ children, sourceQuestion = '' }: { children: ReactNode; sourceQuestion?: string }) {
  const [showChart, setShowChart] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const data = useMemo(() => extractTableData(children), [children])
  const numericColCount = useMemo(() => {
    if (!data) return 0
    return data.headers.slice(1).filter((_, i) => data.rows.every(r => parseNumber(r[i + 1] ?? '') !== null)).length
  }, [data])
  const hasNumericData = numericColCount > 0
  const availableCharts = useMemo(() => data ? getAvailableCharts(data.headers, data.rows, numericColCount) : [], [data, numericColCount])
  const defaultType = availableCharts.find(c => c.recommended)?.type ?? 'bar'
  const [chartType, setChartType] = useState<ChartType>(defaultType)
  const option = useMemo(() => data ? buildOption(data.headers, data.rows, chartType, false) : null, [data, chartType])

  return (
    <div style={{ position: 'relative' }}>
      <table>{children}</table>

      {/* CSV + Pin -- always available */}
      {data && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <button onClick={() => exportCsv(data.headers, data.rows)} style={{ /* pill button style */ }}>
            <FileSpreadsheet size={10} /> CSV
          </button>
          <button onClick={() => pinChart({ title: data.headers.join(' / '), headers: data.headers, rows: data.rows, chartType, sourceQuestion })} style={{ /* pill button style */ }}>
            <Pin size={10} /> Pin
          </button>
        </div>
      )}

      {/* Chart toggle + type picker + fullscreen (only if numeric data) */}
      {hasNumericData && data && option && (
        <>
          <div className="flex items-center gap-2 mt-1 mb-1 flex-wrap">
            <button onClick={() => setShowChart(v => !v)} style={{ /* toggle style */ }}>
              <BarChart3 size={11} /> {showChart ? 'Hide' : 'Chart'}
            </button>
            {showChart && <ChartTypePicker options={availableCharts} selected={chartType} onSelect={setChartType} />}
            {showChart && <button onClick={() => setFullscreen(true)}><Maximize2 size={10} /></button>}
          </div>
          <AnimatePresence>
            {showChart && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 8 }}>
                <div style={{ height: 240 }}>
                  <ReactECharts option={option} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Fullscreen: portal to document.body, dark backdrop with blur, PNG export */}
        </>
      )}
    </div>
  )
}
```

**Integration with KAI chat markdown rendering:**

In the KAI chat component, use custom `react-markdown` components to auto-wrap tables:

```typescript
import KaiTableChart from '@/components/kai/KaiTableChart'

const markdownComponents = {
  table: ({ children }) => <KaiTableChart sourceQuestion={currentQuestion}>{children}</KaiTableChart>,
  a: ({ href, children }) => href?.startsWith('/') ? <Link href={href}>{children}</Link> : <a href={href} target="_blank">{children}</a>,
}
```

---

## `lib/api.ts` — Add These Hooks

```typescript
// Add to existing api.ts — do not remove existing hooks

export function useDataSchema() {
  return useQuery({
    queryKey: ['data-schema'],
    queryFn: () => apiFetch<DataSchemaResponse>('/api/data-schema'),
    staleTime: Infinity,
  })
}

export function useQueryData(config: ChartConfig | null) {
  return useQuery({
    queryKey: ['query-data', config?.source, config?.dimension, config?.measures, config?.period],
    queryFn: () => {
      if (!config) return null
      const params = new URLSearchParams({ source: config.source, dimension: config.dimension, measures: config.measures.join(',') })
      if (config.period) params.set('period', config.period)
      return apiFetch<QueryDataResponse>(`/api/query-data?${params}`)
    },
    enabled: !!config && !!config.dimension && config.measures.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}
```

Add to `lib/types.ts`:
```typescript
export interface DataSchemaSource {
  id: string; label: string; supports_period: boolean
  dimensions: Array<{ column: string; label: string; is_date?: boolean }>
  measures: Array<{ column: string; label: string }>
}
export interface DataSchemaResponse { sources: DataSchemaSource[] }
export interface QueryDataResponse { headers: string[]; rows: string[][] }
```

---

## Chart Builder Sub-Components

### `chart-builder/DraggableField.tsx`

```typescript
'use client'
import { useDraggable } from '@dnd-kit/core'
import { Calendar, Hash } from 'lucide-react'

export interface WellField { column: string; label: string; role: 'dimension' | 'measure' }

interface Props { field: WellField; isUsed: boolean; onClick: () => void }

export default function DraggableField({ field, isUsed, onClick }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source::${field.column}`, data: { field, origin: 'source' },
  })
  const Icon = field.role === 'dimension' ? Calendar : Hash
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6,
      fontSize: 12, fontWeight: 500, cursor: 'grab', userSelect: 'none',
      opacity: isDragging ? 0.35 : 1,
      background: isUsed ? '#eff6ff' : '#f8fafc',
      color: isUsed ? '#097cf7' : '#002151',
      border: `1px solid ${isUsed ? '#bfdbfe' : '#e2e8f0'}`, transition: 'all 120ms',
    }}>
      <Icon size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label}</span>
      {isUsed && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#097cf7', flexShrink: 0 }} />}
    </div>
  )
}
```

### `chart-builder/SortableFieldChip.tsx`

```typescript
'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X } from 'lucide-react'
import type { WellField } from './DraggableField'

interface Props { field: WellField; wellName: string; onRemove: () => void }

export default function SortableFieldChip({ field, wellName, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `well::${wellName}::${field.column}`, data: { field, origin: wellName },
  })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5,
        fontSize: 11, fontWeight: 600, background: '#097cf7', color: '#fff', cursor: 'grab',
      }} {...listeners} {...attributes}>
        <span style={{ flex: 1 }}>{field.label}</span>
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} style={{ color: 'rgba(255,255,255,0.7)', cursor: 'pointer', lineHeight: 1 }}><X size={11} /></button>
      </div>
    </div>
  )
}
```

### `chart-builder/FieldWell.tsx`

```typescript
'use client'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import SortableFieldChip from './SortableFieldChip'
import type { WellField } from './DraggableField'

interface Props { wellName: string; label: string; items: WellField[]; onRemove: (col: string) => void; acceptsRole: 'dimension' | 'measure'; placeholder?: string }

export default function FieldWell({ wellName, label, items, onRemove, acceptsRole, placeholder }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `well::${wellName}`, data: { accepts: acceptsRole } })
  const sortableIds = items.map((f) => `well::${wellName}::${f.column}`)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div ref={setNodeRef} style={{ minHeight: 36, padding: items.length > 0 ? '4px' : '0 8px', borderRadius: 7, border: `1.5px dashed ${isOver ? '#097cf7' : '#d1d5db'}`, background: isOver ? '#eff6ff' : '#fafbfc', display: 'flex', flexDirection: 'column', gap: 3, transition: 'all 120ms' }}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {items.map((f) => <SortableFieldChip key={f.column} field={f} wellName={wellName} onRemove={() => onRemove(f.column)} />)}
        </SortableContext>
        {items.length === 0 && <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{placeholder ?? `Drop ${acceptsRole}s here`}</div>}
      </div>
    </div>
  )
}
```

---

## `app/(dashboard)/custom/ChartBuilderSidebar.tsx`

Copy verbatim, then **adapt `SOURCE_LABELS` and `SOURCE_BADGE_COLORS`** (lines marked `// CUSTOMIZE:`) to match app's `DataSource` type:

```typescript
// CUSTOMIZE: match DataSource type from chart-config-storage.ts
const SOURCE_LABELS: Record<DataSource, string> = {
  table_a: 'Human Label A',
  table_b: 'Human Label B',
}
const SOURCE_BADGE_COLORS: Record<DataSource, string> = {
  table_a: '#097cf7',
  table_b: '#8b5cf6',
}
```

```typescript
'use client'

/**
 * KAI Client -- ChartBuilderSidebar
 * Source: keboola/kai-client/kai-nextjs/
 * Copy verbatim. Only modify lines marked // CUSTOMIZE:
 */

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { X, Loader2, Plus, Pencil, Trash2, BarChart2 } from 'lucide-react'

import { useDataSchema, useQueryData } from '@/lib/api'
import { buildOption, TYPES } from '@/lib/chart-utils'
import type { ChartType } from '@/lib/chart-utils'
import { saveConfig, updateConfig, deleteConfig, useChartLibrary, getLibrary } from '@/lib/chart-config-storage'
import type { ChartConfig, DataSource, Period } from '@/lib/chart-config-storage'
import { addDynamicChart } from '@/lib/dashboard-storage'
import { COLORS } from '@/lib/constants'
import DraggableField from './chart-builder/DraggableField'
import type { WellField } from './chart-builder/DraggableField'
import FieldWell from './chart-builder/FieldWell'

// -- Constants ----

// CUSTOMIZE: DataSource type definition (in chart-config-storage.ts)
export type DataSource_Ref = DataSource

const SOURCE_LABELS: Record<DataSource, string> = { // CUSTOMIZE:
  marketing_metrics: 'Marketing Metrics',
  executive_dashboard: 'Overview / Executive',
  lifecycle_stages: 'Lifecycle Stages',
}

const SOURCE_BADGE_COLORS: Record<DataSource, string> = { // CUSTOMIZE:
  marketing_metrics: '#097cf7',
  executive_dashboard: '#8b5cf6',
  lifecycle_stages: '#16a34a',
}

const PERIOD_OPTIONS: { value: Period | 'all'; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'L3M', label: 'Last 3 months' },
  { value: 'L6M', label: 'Last 6 months' },
  { value: 'YTD', label: 'Year to date' },
  { value: '12M', label: 'Last 12 months' },
]

// -- Props ----

export type SidebarMode = 'new' | 'edit' | 'library'

interface Props {
  mode: SidebarMode
  editingConfigId: string | null
  activeId: string
  onClose: () => void
  onSwitchMode: (mode: SidebarMode) => void
  onEditConfig: (configId: string) => void
}

// -- Component ----

export default function ChartBuilderSidebar({ mode, editingConfigId, activeId, onClose, onSwitchMode, onEditConfig }: Props) {
  const { data: schema } = useDataSchema()
  const configs = useChartLibrary()

  // -- Draft state --
  const [source, setSource] = useState<DataSource>('marketing_metrics')
  const [axisField, setAxisField] = useState<WellField | null>(null)
  const [valuesFields, setValuesFields] = useState<WellField[]>([])
  const [period, setPeriod] = useState<Period | null>('L6M')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)

  // -- DnD state --
  const [activeDragField, setActiveDragField] = useState<WellField | null>(null)
  const [, setHoveredWell] = useState<string | null>(null)

  // -- Sensors --
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // -- Populate draft from editing config --
  useEffect(() => {
    if (mode === 'edit' && editingConfigId) {
      const config = getLibrary().configs.find((c) => c.id === editingConfigId)
      if (config) {
        setSource(config.source)
        setPeriod(config.period)
        setChartType(config.chartType)
        setName(config.name)
        const src = schema?.sources.find((s) => s.id === config.source)
        if (src) {
          const dim = src.dimensions.find((d) => d.column === config.dimension)
          setAxisField(dim ? { column: dim.column, label: dim.label, role: 'dimension' } : null)
          const wellFields: WellField[] = []
          for (const m of config.measures) {
            const measure = src.measures.find((ms) => ms.column === m)
            if (measure) wellFields.push({ column: measure.column, label: measure.label, role: 'measure' })
          }
          setValuesFields(wellFields)
        }
      }
    } else if (mode === 'new') {
      setAxisField(null)
      setValuesFields([])
      setPeriod('L6M')
      setChartType('bar')
      setName('')
      setSaved(false)
      autoPopulateAxis(source)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, editingConfigId, schema])

  // -- Source schema --
  const sourceSchema = schema?.sources.find((s) => s.id === source)
  const supportsPeriod = sourceSchema?.supports_period ?? false

  // -- Auto-populate axis when source has single dimension --
  function autoPopulateAxis(src: DataSource) {
    const srcSchema = schema?.sources.find((s) => s.id === src)
    if (srcSchema && srcSchema.dimensions.length === 1) {
      const d = srcSchema.dimensions[0]
      setAxisField({ column: d.column, label: d.label, role: 'dimension' })
    }
  }

  // -- Build fields list --
  const fields: WellField[] = useMemo(() => {
    if (!sourceSchema) return []
    const dims: WellField[] = sourceSchema.dimensions.map((d) => ({ column: d.column, label: d.label, role: 'dimension' }))
    const measures: WellField[] = sourceSchema.measures.map((m) => ({ column: m.column, label: m.label, role: 'measure' }))
    return [...dims, ...measures]
  }, [sourceSchema])

  const usedColumns = new Set([axisField?.column, ...valuesFields.map((f) => f.column)].filter(Boolean))

  // -- Source change --
  const handleSourceChange = (newSource: DataSource) => {
    setSource(newSource)
    setAxisField(null)
    setValuesFields([])
    if (!schema?.sources.find((s) => s.id === newSource)?.supports_period) {
      setPeriod(null)
    }
    autoPopulateAxis(newSource)
  }

  // -- Click-to-add --
  const handleFieldClick = (field: WellField) => {
    if (field.role === 'dimension') {
      setAxisField(field)
    } else {
      setValuesFields((prev) => (prev.some((f) => f.column === field.column) ? prev : [...prev, field]))
    }
  }

  // -- DnD handlers --
  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { field: WellField } | undefined
    setActiveDragField(data?.field ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event
    if (!over) { setHoveredWell(null); return }
    const overId = String(over.id)
    if (overId.startsWith('well::axis')) setHoveredWell('axis')
    else if (overId.startsWith('well::values')) setHoveredWell('values')
    else setHoveredWell(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragField(null)
    setHoveredWell(null)
    const { active, over } = event
    if (!over) return
    const activeData = active.data.current as { field: WellField; origin: string } | undefined
    if (!activeData) return
    const overId = String(over.id)

    if (activeData.origin === 'source' && overId.startsWith('well::axis')) {
      if (activeData.field.role === 'dimension') setAxisField(activeData.field)
      return
    }
    if (activeData.origin === 'source' && (overId.startsWith('well::values'))) {
      if (activeData.field.role === 'measure') {
        setValuesFields((prev) => (prev.some((f) => f.column === activeData.field.column) ? prev : [...prev, activeData.field]))
      }
      return
    }
    if (activeData.origin === 'values' && overId.startsWith('well::values::')) {
      const oldIndex = valuesFields.findIndex((f) => `well::values::${f.column}` === String(active.id))
      const newIndex = valuesFields.findIndex((f) => `well::values::${f.column}` === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setValuesFields((prev) => arrayMove(prev, oldIndex, newIndex))
      }
    }
  }

  // -- Live preview --
  const previewConfig = useMemo((): ChartConfig | null => {
    if (!source || !axisField || valuesFields.length === 0) return null
    return {
      id: '__preview__',
      name: 'preview',
      source,
      dimension: axisField.column,
      measures: valuesFields.map((f) => f.column),
      period: supportsPeriod ? period : null,
      chartType,
      createdAt: '',
      updatedAt: '',
    }
  }, [source, axisField, valuesFields, period, chartType, supportsPeriod])

  const { data: queryData, isFetching } = useQueryData(previewConfig)
  const previewOption = useMemo(() => {
    if (!queryData) return null
    return buildOption(queryData.headers, queryData.rows, chartType, false)
  }, [queryData, chartType])

  // -- Auto-generate name --
  useEffect(() => {
    if (mode === 'new' && !name && axisField && valuesFields.length > 0) {
      const measureNames = valuesFields.slice(0, 2).map((f) => f.label).join(', ')
      setName(`${measureNames} by ${axisField.label}`)
    }
  }, [axisField, valuesFields, mode, name])

  // -- Save --
  const canSave = axisField !== null && valuesFields.length > 0 && name.trim() !== ''

  const handleSave = () => {
    if (!canSave || !axisField) return
    const payload = {
      name: name.trim(),
      source,
      dimension: axisField.column,
      measures: valuesFields.map((f) => f.column),
      period: supportsPeriod ? period : null,
      chartType,
    }
    if (mode === 'edit' && editingConfigId) {
      updateConfig(editingConfigId, payload)
    } else {
      const config = saveConfig(payload)
      addDynamicChart(config.id, activeId)
    }
    setSaved(true)
    setTimeout(onClose, 400)
  }

  // -- Library actions --
  const handleLibraryAdd = (configId: string) => {
    addDynamicChart(configId, activeId)
  }

  const handleLibraryEdit = (configId: string) => {
    onEditConfig(configId)
  }

  const isBuilder = mode === 'new' || mode === 'edit'

  return (
    <motion.aside
      initial={{ x: 340 }}
      animate={{ x: 0 }}
      exit={{ x: 340 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        zIndex: 50,
        background: '#fff',
        borderLeft: '1px solid #e2e8f0',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#002151', margin: 0 }}>
            {mode === 'edit' ? 'Edit Chart' : mode === 'library' ? 'Chart Library' : 'Build Chart'}
          </h3>
          <button onClick={onClose} style={{ color: '#94a3b8', cursor: 'pointer', padding: 2 }}><X size={16} /></button>
        </div>
        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 6, padding: 2 }}>
          <button
            onClick={() => onSwitchMode(mode === 'edit' ? 'edit' : 'new')}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: isBuilder ? '#fff' : 'transparent',
              color: isBuilder ? '#002151' : '#64748b',
              boxShadow: isBuilder ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 150ms',
            }}
          >
            Builder
          </button>
          <button
            onClick={() => onSwitchMode('library')}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: mode === 'library' ? '#fff' : 'transparent',
              color: mode === 'library' ? '#002151' : '#64748b',
              boxShadow: mode === 'library' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 150ms',
            }}
          >
            Library ({configs.length})
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {mode === 'library' ? (
          /* -- Library Tab -- */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {configs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                <BarChart2 size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>No saved charts</p>
                <p style={{ fontSize: 11 }}>Use the Builder tab to create one</p>
              </div>
            ) : (
              configs.map((config) => (
                <div
                  key={config.id}
                  style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', background: '#fff' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#002151', flex: 1 }}>{config.name}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, whiteSpace: 'nowrap', flexShrink: 0,
                      background: SOURCE_BADGE_COLORS[config.source] + '18',
                      color: SOURCE_BADGE_COLORS[config.source],
                    }}>
                      {SOURCE_LABELS[config.source].split(' ')[0]}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
                    {config.chartType.replace('-', ' ')} · {config.measures.slice(0, 2).join(', ')}
                    {config.measures.length > 2 && ` +${config.measures.length - 2}`}
                    {config.period && ` · ${config.period}`}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => handleLibraryAdd(config.id)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: COLORS.brandPrimary, color: '#fff', border: 'none' }}
                    >
                      <Plus size={12} /> Add
                    </button>
                    <button
                      onClick={() => handleLibraryEdit(config.id)}
                      style={{ padding: '5px 7px', borderRadius: 5, cursor: 'pointer', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deleteConfig(config.id)}
                      style={{ padding: '5px 7px', borderRadius: 5, cursor: 'pointer', background: '#fff1f1', color: '#dc2626', border: '1px solid #fecaca', display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* -- Builder Tab -- */
          <DndContext
            id="field-wells-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {/* Source selector */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Data Source
              </div>
              <select
                value={source}
                onChange={(e) => handleSourceChange(e.target.value as DataSource)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#002151', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {(Object.keys(SOURCE_LABELS) as DataSource[]).map((s) => (
                  <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Fields list */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Fields
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {fields.map((f) => (
                  <DraggableField
                    key={f.column}
                    field={f}
                    isUsed={usedColumns.has(f.column)}
                    onClick={() => handleFieldClick(f)}
                  />
                ))}
              </div>
            </div>

            {/* Wells */}
            <FieldWell
              wellName="axis"
              label="Axis (X)"
              items={axisField ? [axisField] : []}
              onRemove={() => setAxisField(null)}
              acceptsRole="dimension"
              placeholder="Drag a dimension here"
            />
            <FieldWell
              wellName="values"
              label="Values (Y)"
              items={valuesFields}
              onRemove={(col) => setValuesFields((prev) => prev.filter((f) => f.column !== col))}
              acceptsRole="measure"
              placeholder="Drag measures here"
            />

            {/* Drag overlay */}
            <DragOverlay style={{ zIndex: 55 }}>
              {activeDragField ? (
                <div style={{
                  padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                  background: '#097cf7', color: '#fff', boxShadow: '0 4px 12px rgba(9,124,247,0.3)',
                  whiteSpace: 'nowrap',
                }}>
                  {activeDragField.label}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Chart type (builder only) */}
        {isBuilder && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Chart Type
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setChartType(t as ChartType)}
                  style={{
                    padding: '4px 9px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    background: chartType === t ? COLORS.brandPrimary : '#f8fafc',
                    color: chartType === t ? '#fff' : '#64748b',
                    border: `1px solid ${chartType === t ? COLORS.brandPrimary : '#e2e8f0'}`,
                    transition: 'all 120ms',
                  }}
                >
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Period (builder only, when supported) */}
        {isBuilder && supportsPeriod && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Period
            </div>
            <select
              value={period ?? 'all'}
              onChange={(e) => setPeriod(e.target.value === 'all' ? null : (e.target.value as Period))}
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#002151', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Mini preview (builder only) */}
        {isBuilder && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Preview
            </div>
            <div style={{ height: 180, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isFetching && !queryData ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 11 }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
                </div>
              ) : previewOption ? (
                <ReactECharts option={previewOption} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />
              ) : (
                <span style={{ color: '#94a3b8', fontSize: 11 }}>
                  {axisField && valuesFields.length > 0 ? 'No data' : 'Add fields to see preview'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Name input (builder only) */}
        {isBuilder && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Chart Name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave() }}
              placeholder="e.g. Revenue by Month"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#002151', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        )}
      </div>

      {/* Footer (builder only) */}
      {isBuilder && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saved}
            style={{
              flex: 1, padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', border: 'none',
              background: saved ? '#16a34a' : canSave ? COLORS.brandPrimary : '#e2e8f0',
              color: canSave || saved ? '#fff' : '#94a3b8',
              transition: 'all 150ms',
            }}
          >
            {saved ? 'Saved!' : mode === 'edit' ? 'Update' : 'Save & Add'}
          </button>
        </div>
      )}
    </motion.aside>
  )
}
```

---

## `app/(dashboard)/custom/page.tsx`

Copy verbatim. **Seeding is optional** — if the app doesn't have a `/api/custom-dashboard-data` endpoint, remove `useCustomDashboardData`, `buildSeedCharts()`, and the seeding `useEffect`. Do not remove `PAGE_STYLES`.

```typescript
'use client'

/**
 * KAI Client -- Custom Dashboard Page
 * Source: keboola/kai-client/kai-nextjs/
 * Copy verbatim. Only modify lines marked // CUSTOMIZE:
 */

import { useState, useRef, useMemo, useCallback, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { createPortal } from 'react-dom'
import { X, Maximize2, Pencil, Check, Trash2, LayoutGrid, Download, Image, PlusCircle, BookOpen, Loader2, RefreshCw } from 'lucide-react'
import Draggable from 'react-draggable'
import { Resizable as ResizableBase } from 'react-resizable'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Resizable = ResizableBase as any
import 'react-resizable/css/styles.css'

import { AnimatePresence } from 'framer-motion'
import { useCustomDashboardData, useQueryData } from '@/lib/api'
import { COLORS } from '@/lib/constants'
import { buildOption, TYPES } from '@/lib/chart-utils'
import {
  useDashboards,
  getActiveDashboardId,
  setActiveDashboardId,
  createDashboard,
  renameDashboard,
  deleteDashboard,
  unpinChart,
  updateChartTitle,
  updateChartType,
  updateAllLayouts,
  isDashboardSeeded,
  seedDemoCharts,
} from '@/lib/dashboard-storage'
import type { PinnedChart, Dashboard, AnyDashboardChart } from '@/lib/dashboard-storage'
import type { CustomDashboardData } from '@/lib/types'
import { getLibrary } from '@/lib/chart-config-storage'
import ChartBuilderSidebar from './ChartBuilderSidebar'
import type { SidebarMode } from './ChartBuilderSidebar'

// -- Snap helpers ----

const SNAP = 24 // dot grid size in px
const MAGNET = SNAP // magnetic edge attraction = 1 dot

function snap(v: number) {
  return Math.round(v / SNAP) * SNAP
}

function tooClose(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number, gap = 0): boolean {
  return ax < bx + bw + gap && ax + aw > bx - gap && ay < by + bh + gap && ay + ah > by - gap
}
function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return tooClose(ax, ay, aw, ah, bx, by, bw, bh, 0)
}

type SnapEdges = { left: boolean; right: boolean; top: boolean; bottom: boolean }

function magnetSnap(
  x: number, y: number, w: number, h: number,
  others: PinnedChart[],
): { x: number; y: number; edges: SnapEdges } {
  let sx = x, sy = y
  const edges: SnapEdges = { left: false, right: false, top: false, bottom: false }

  for (const o of others) {
    const oL = o.x, oR = o.x + o.w, oT = o.y, oB = o.y + o.h
    if (!edges.left && !edges.right) {
      if (Math.abs(x - (oR + SNAP)) <= MAGNET)         { sx = oR + SNAP;         edges.left = true }
      else if (Math.abs((x + w) - (oL - SNAP)) <= MAGNET) { sx = oL - SNAP - w; edges.right = true }
    }
    if (!edges.top && !edges.bottom) {
      if (Math.abs(y - (oB + SNAP)) <= MAGNET)         { sy = oB + SNAP;         edges.top = true }
      else if (Math.abs((y + h) - (oT - SNAP)) <= MAGNET) { sy = oT - SNAP - h; edges.bottom = true }
    }
  }

  return { x: Math.max(0, sx), y: Math.max(0, sy), edges }
}

// -- Chart Card ----

interface ChartItemProps {
  chart: PinnedChart
  others: PinnedChart[]
  containerWidth: number
  onDragStop: (id: string, x: number, y: number) => void
  onResizeStop: (id: string, x: number, y: number, w: number, h: number) => void
}

function ChartItem({ chart, others, containerWidth, onDragStop, onResizeStop }: ChartItemProps) {
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(chart.title)
  const [fullscreen, setFullscreen] = useState(false)
  const [pos, setPos] = useState({ x: chart.x, y: chart.y })
  const [size, setSize] = useState({ w: chart.w, h: chart.h })
  const [snapEdges, setSnapEdges] = useState<SnapEdges>({ left: false, right: false, top: false, bottom: false })
  const [isDragging, setIsDragging] = useState(false)
  const lastValidPos = useRef({ x: chart.x, y: chart.y })
  const resizeStartRef = useRef({ x: chart.x, y: chart.y, w: chart.w, h: chart.h })
  const chartRef = useRef<any>(null)
  const nodeRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setPos({ x: chart.x, y: chart.y }); lastValidPos.current = { x: chart.x, y: chart.y } }, [chart.x, chart.y])
  useEffect(() => { setSize({ w: chart.w, h: chart.h }) }, [chart.w, chart.h])

  useEffect(() => {
    chartRef.current?.getEchartsInstance?.()?.resize?.()
  }, [size])

  const option = useMemo(() => buildOption(chart.headers, chart.rows, chart.chartType, false), [chart.headers, chart.rows, chart.chartType])
  const fsOption = useMemo(() => buildOption(chart.headers, chart.rows, chart.chartType, true), [chart.headers, chart.rows, chart.chartType])

  const handleTitleSave = () => { if (titleDraft.trim()) updateChartTitle(chart.id, titleDraft.trim()); setEditing(false) }

  const snapBorder = {
    borderTop: snapEdges.top ? '2px solid #097cf7' : undefined,
    borderBottom: snapEdges.bottom ? '2px solid #097cf7' : undefined,
    borderLeft: snapEdges.left ? '2px solid #097cf7' : undefined,
    borderRight: snapEdges.right ? '2px solid #097cf7' : undefined,
  }

  return (
    <Draggable
      nodeRef={nodeRef as React.RefObject<HTMLElement>}
      handle=".chart-drag-handle"
      grid={[SNAP, SNAP]}
      position={pos}
      bounds={{ left: 0, top: 0, right: containerWidth > 0 ? containerWidth - size.w : undefined }}
      onStart={() => setIsDragging(true)}
      onDrag={(_e, d) => {
        const proposed = { x: Math.max(0, d.x), y: Math.max(0, d.y) }
        const blocked = others.some((o) => overlaps(proposed.x, proposed.y, size.w, size.h, o.x, o.y, o.w, o.h))
        if (!blocked) {
          lastValidPos.current = proposed
          setPos(proposed)
        } else {
          setPos(lastValidPos.current)
        }
        const { edges } = magnetSnap(proposed.x, proposed.y, size.w, size.h, others)
        setSnapEdges(edges)
      }}
      onStop={() => {
        setIsDragging(false)
        const base = lastValidPos.current
        const { x, y, edges } = magnetSnap(snap(base.x), snap(base.y), size.w, size.h, others)
        const snappedBlocked = others.some((o) => overlaps(x, y, size.w, size.h, o.x, o.y, o.w, o.h))
        const fx = snappedBlocked ? snap(base.x) : x
        const fy = snappedBlocked ? snap(base.y) : y
        setPos({ x: fx, y: fy })
        setSnapEdges(snappedBlocked ? { left: false, right: false, top: false, bottom: false } : edges)
        setTimeout(() => setSnapEdges({ left: false, right: false, top: false, bottom: false }), 400)
        onDragStop(chart.id, fx, fy)
      }}
    >
      <div ref={nodeRef} style={{ position: 'absolute', width: size.w, height: size.h }}>
        <Resizable
          width={size.w}
          height={size.h}
          minConstraints={[144, 96]}
          grid={[SNAP, SNAP]}
          onResizeStart={() => {
            resizeStartRef.current = { x: pos.x, y: pos.y, w: size.w, h: size.h }
          }}
          onResize={(_e: React.SyntheticEvent, data: any) => {
            const { size: s, handle } = data
            const isLeft = (handle as string).includes('w')
            const isTop = (handle as string).includes('n')
            let newW = s.width
            let newH = s.height
            let newX = isLeft
              ? Math.max(0, resizeStartRef.current.x + resizeStartRef.current.w - newW)
              : pos.x
            let newY = isTop
              ? Math.max(0, resizeStartRef.current.y + resizeStartRef.current.h - newH)
              : pos.y
            if (containerWidth > 0 && newX + newW > containerWidth) newW = containerWidth - newX
            if (others.some((o) => tooClose(newX, newY, newW, newH, o.x, o.y, o.w, o.h, SNAP))) {
              if (isLeft) { newX = pos.x; newW = size.w }
              else if (isTop) { newY = pos.y; newH = size.h }
              else { newW = size.w; newH = size.h }
            }
            setPos({ x: newX, y: newY })
            setSize({ w: newW, h: newH })
          }}
          onResizeStop={(_e: React.SyntheticEvent, data: any) => {
            const { size: s, handle } = data
            const isLeft = (handle as string).includes('w')
            const isTop = (handle as string).includes('n')
            let newW = snap(s.width)
            let newH = snap(s.height)
            let newX = isLeft
              ? snap(Math.max(0, resizeStartRef.current.x + resizeStartRef.current.w - newW))
              : snap(pos.x)
            let newY = isTop
              ? snap(Math.max(0, resizeStartRef.current.y + resizeStartRef.current.h - newH))
              : snap(pos.y)
            if (containerWidth > 0 && newX + newW > containerWidth) newW = snap(containerWidth - newX)
            if (others.some((o) => tooClose(newX, newY, newW, newH, o.x, o.y, o.w, o.h, SNAP))) {
              if (isLeft) { newX = snap(pos.x); newW = snap(size.w) }
              else if (isTop) { newY = snap(pos.y); newH = snap(size.h) }
              else { newW = snap(size.w); newH = snap(size.h) }
            }
            setPos({ x: newX, y: newY })
            setSize({ w: newW, h: newH })
            onResizeStop(chart.id, newX, newY, newW, newH)
          }}
          resizeHandles={['se', 'sw', 'ne', 'nw', 's', 'n', 'e', 'w']}
        >
          <div style={{ width: size.w, height: size.h, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', transition: 'box-shadow 150ms', ...snapBorder }}>
            {/* Drag handle header */}
            <div className="chart-drag-handle" style={{ cursor: 'grab', background: 'rgba(248,250,252,0.9)', borderBottom: '1px solid #e2e8f0', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 32, flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                {editing ? (
                  <input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setTitleDraft(chart.title); setEditing(false) } }}
                    onBlur={handleTitleSave}
                    style={{ fontSize: 11, fontWeight: 600, color: '#002151', background: 'transparent', border: 'none', outline: 'none', flex: 1, minWidth: 0 }}
                  />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#002151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chart.title}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {editing ? (
                  <button onClick={handleTitleSave} style={{ color: '#16a34a', cursor: 'pointer', padding: 1 }}><Check size={12} /></button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setEditing(true) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Rename"><Pencil size={12} /></button>
                )}
                <button onClick={(e) => { e.stopPropagation(); setFullscreen(true) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Fullscreen"><Maximize2 size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); unpinChart(chart.id) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Remove"><X size={12} /></button>
              </div>
            </div>

            {/* Chart type pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 8px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', flexShrink: 0 }}>
              {TYPES.map((t) => (
                <button key={t} onClick={() => updateChartType(chart.id, t)}
                  style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', transition: 'all 150ms', background: chart.chartType === t ? COLORS.brandPrimary : 'transparent', color: chart.chartType === t ? '#fff' : '#64748b', border: `1px solid ${chart.chartType === t ? COLORS.brandPrimary : '#e2e8f0'}` }}>
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>

            {/* Chart */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {option ? (
                <ReactECharts ref={chartRef} option={option} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11 }}>No data</div>
              )}
            </div>
          </div>
        </Resizable>

        {/* Fullscreen */}
        {fullscreen && typeof document !== 'undefined' && createPortal(
          <motion.div className="fixed inset-0" style={{ zIndex: 998, background: 'rgba(0,10,26,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ width: '100%', maxWidth: 1100, height: '80vh', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: '#002151' }}>{chart.title}</span>
                <button onClick={() => setFullscreen(false)} style={{ color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: 16 }}>
                {fsOption && <ReactECharts option={fsOption} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />}
              </div>
            </div>
          </motion.div>,
          document.body,
        )}
      </div>
    </Draggable>
  )
}

// -- Dynamic Chart (live query) ----

interface DynamicChartContentProps {
  configId: string
  chartId: string
  others: AnyDashboardChart[]
  containerWidth: number
  onDragStop: (id: string, x: number, y: number) => void
  onResizeStop: (id: string, x: number, y: number, w: number, h: number) => void
  x: number; y: number; w: number; h: number
  pinnedAt: string
  isSelected?: boolean
  onSelect?: (chartId: string) => void
}

function DynamicChartContent({ configId, chartId, others, containerWidth, onDragStop, onResizeStop, x, y, w, h, isSelected, onSelect }: DynamicChartContentProps) {
  const config = getLibrary().configs.find((c) => c.id === configId) ?? null
  const { data, isFetching, refetch } = useQueryData(config)
  const [fullscreen, setFullscreen] = useState(false)
  const [pos, setPos] = useState({ x, y })
  const [size, setSize] = useState({ w, h })
  const [snapEdges, setSnapEdges] = useState<SnapEdges>({ left: false, right: false, top: false, bottom: false })
  const [isDragging, setIsDragging] = useState(false)
  const lastValidPos = useRef({ x, y })
  const resizeStartRef = useRef({ x, y, w, h })
  const chartRef = useRef<any>(null)
  const nodeRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setPos({ x, y }); lastValidPos.current = { x, y } }, [x, y])
  useEffect(() => { setSize({ w, h }) }, [w, h])
  useEffect(() => { chartRef.current?.getEchartsInstance?.()?.resize?.() }, [size])

  const othersRect = others.map((o) => ({ ...o, title: '', headers: [], rows: [], chartType: 'bar', pinnedAt: '', sourceQuestion: '' } as PinnedChart))

  const option = useMemo(() => data ? buildOption(data.headers, data.rows, config?.chartType ?? 'bar', false) : null, [data, config?.chartType])
  const fsOption = useMemo(() => data ? buildOption(data.headers, data.rows, config?.chartType ?? 'bar', true) : null, [data, config?.chartType])

  const snapBorder = {
    borderTop: snapEdges.top ? '2px solid #097cf7' : undefined,
    borderBottom: snapEdges.bottom ? '2px solid #097cf7' : undefined,
    borderLeft: snapEdges.left ? '2px solid #097cf7' : undefined,
    borderRight: snapEdges.right ? '2px solid #097cf7' : undefined,
  }

  if (!config) return null

  return (
    <Draggable
      nodeRef={nodeRef as React.RefObject<HTMLElement>}
      handle=".chart-drag-handle"
      grid={[SNAP, SNAP]}
      position={pos}
      bounds={{ left: 0, top: 0, right: containerWidth > 0 ? containerWidth - size.w : undefined }}
      onStart={() => setIsDragging(true)}
      onDrag={(_e, d) => {
        const proposed = { x: Math.max(0, d.x), y: Math.max(0, d.y) }
        const blocked = othersRect.some((o) => overlaps(proposed.x, proposed.y, size.w, size.h, o.x, o.y, o.w, o.h))
        if (!blocked) { lastValidPos.current = proposed; setPos(proposed) }
        else setPos(lastValidPos.current)
        const { edges } = magnetSnap(proposed.x, proposed.y, size.w, size.h, othersRect)
        setSnapEdges(edges)
      }}
      onStop={() => {
        setIsDragging(false)
        const base = lastValidPos.current
        const { x: fx, y: fy, edges } = magnetSnap(snap(base.x), snap(base.y), size.w, size.h, othersRect)
        const snappedBlocked = othersRect.some((o) => overlaps(fx, fy, size.w, size.h, o.x, o.y, o.w, o.h))
        const finalX = snappedBlocked ? snap(base.x) : fx
        const finalY = snappedBlocked ? snap(base.y) : fy
        setPos({ x: finalX, y: finalY })
        setSnapEdges(snappedBlocked ? { left: false, right: false, top: false, bottom: false } : edges)
        setTimeout(() => setSnapEdges({ left: false, right: false, top: false, bottom: false }), 400)
        onDragStop(chartId, finalX, finalY)
      }}
    >
      <div ref={nodeRef} style={{ position: 'absolute', width: size.w, height: size.h }}>
        <Resizable
          width={size.w} height={size.h}
          minConstraints={[144, 96]} grid={[SNAP, SNAP]}
          onResizeStart={() => { resizeStartRef.current = { x: pos.x, y: pos.y, w: size.w, h: size.h } }}
          onResize={(_e: React.SyntheticEvent, data: any) => {
            const { size: s, handle } = data
            const isLeft = (handle as string).includes('w')
            const isTop = (handle as string).includes('n')
            let newW = s.width, newH = s.height
            let newX = isLeft ? Math.max(0, resizeStartRef.current.x + resizeStartRef.current.w - newW) : pos.x
            let newY = isTop ? Math.max(0, resizeStartRef.current.y + resizeStartRef.current.h - newH) : pos.y
            if (containerWidth > 0 && newX + newW > containerWidth) newW = containerWidth - newX
            if (othersRect.some((o) => tooClose(newX, newY, newW, newH, o.x, o.y, o.w, o.h, SNAP))) {
              if (isLeft) { newX = pos.x; newW = size.w }
              else if (isTop) { newY = pos.y; newH = size.h }
              else { newW = size.w; newH = size.h }
            }
            setPos({ x: newX, y: newY }); setSize({ w: newW, h: newH })
          }}
          onResizeStop={(_e: React.SyntheticEvent, data: any) => {
            const { size: s, handle } = data
            const isLeft = (handle as string).includes('w')
            const isTop = (handle as string).includes('n')
            let newW = snap(s.width), newH = snap(s.height)
            let newX = isLeft ? snap(Math.max(0, resizeStartRef.current.x + resizeStartRef.current.w - newW)) : snap(pos.x)
            let newY = isTop ? snap(Math.max(0, resizeStartRef.current.y + resizeStartRef.current.h - newH)) : snap(pos.y)
            if (containerWidth > 0 && newX + newW > containerWidth) newW = snap(containerWidth - newX)
            if (othersRect.some((o) => tooClose(newX, newY, newW, newH, o.x, o.y, o.w, o.h, SNAP))) {
              if (isLeft) { newX = snap(pos.x); newW = snap(size.w) }
              else if (isTop) { newY = snap(pos.y); newH = snap(size.h) }
              else { newW = snap(size.w); newH = snap(size.h) }
            }
            setPos({ x: newX, y: newY }); setSize({ w: newW, h: newH })
            onResizeStop(chartId, newX, newY, newW, newH)
          }}
          resizeHandles={['se', 'sw', 'ne', 'nw', 's', 'n', 'e', 'w']}
        >
          <div
            onClick={() => onSelect?.(chartId)}
            style={{ width: size.w, height: size.h, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.06)', border: isSelected ? '2px solid #097cf7' : '1px solid #e2e8f0', transition: 'box-shadow 150ms, border 150ms', ...snapBorder }}
          >
            <div className="chart-drag-handle" style={{ cursor: 'grab', background: 'rgba(248,250,252,0.9)', borderBottom: '1px solid #e2e8f0', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 32, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#002151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{config.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {isFetching && <Loader2 size={11} style={{ color: '#94a3b8', animation: 'spin 1s linear infinite' }} />}
                <button onClick={(e) => { e.stopPropagation(); refetch() }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Refresh"><RefreshCw size={11} /></button>
                <button onClick={(e) => { e.stopPropagation(); setFullscreen(true) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Fullscreen"><Maximize2 size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); unpinChart(chartId) }} style={{ color: '#94a3b8', cursor: 'pointer', padding: 1 }} title="Remove from dashboard"><X size={12} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 8px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: COLORS.brandPrimary, color: '#fff' }}>{config.chartType.replace('-', ' ')}</span>
              <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>{config.source.replace('_', ' ')} · {config.period ?? 'all time'}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {isFetching && !data ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11, gap: 6 }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
                </div>
              ) : option ? (
                <ReactECharts ref={chartRef} option={option} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11 }}>No data</div>
              )}
            </div>
          </div>
        </Resizable>

        {fullscreen && typeof document !== 'undefined' && createPortal(
          <motion.div className="fixed inset-0" style={{ zIndex: 998, background: 'rgba(0,10,26,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ width: '100%', maxWidth: 1100, height: '80vh', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: '#002151' }}>{config.name}</span>
                <button onClick={() => setFullscreen(false)} style={{ color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: 16 }}>
                {fsOption && <ReactECharts option={fsOption} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'canvas' }} />}
              </div>
            </div>
          </motion.div>,
          document.body,
        )}
      </div>
    </Draggable>
  )
}

// -- Dashboard Tabs ----

function DashboardTabs({ dashboards, activeId }: { dashboards: Dashboard[]; activeId: string }) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const handleRenameStart = (db: Dashboard) => { setRenamingId(db.id); setNameDraft(db.name) }
  const handleRenameSave = () => { if (renamingId && nameDraft.trim()) renameDashboard(renamingId, nameDraft.trim()); setRenamingId(null) }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {dashboards.map((db) => {
        const isActive = db.id === activeId
        return (
          <div key={db.id} onClick={() => setActiveDashboardId(db.id)} onDoubleClick={() => handleRenameStart(db)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm font-medium transition-all duration-150 select-none ${isActive ? 'bg-brand-secondary text-white shadow-sm' : 'bg-white border border-border text-brand-secondary/70 hover:bg-brand-secondary/5'}`}>
            {renamingId === db.id ? (
              <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') setRenamingId(null) }}
                onBlur={handleRenameSave} className="bg-transparent text-white outline-none w-24 text-sm font-medium" onClick={(e) => e.stopPropagation()} />
            ) : <span>{db.name}</span>}
            {isActive && dashboards.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); deleteDashboard(db.id) }} className="opacity-60 hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
            )}
          </div>
        )
      })}
      <button onClick={() => createDashboard('New Dashboard')} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-brand-secondary/60 border border-dashed border-border hover:text-brand-secondary hover:border-brand-secondary/40 transition-all duration-150">+ New</button>
    </div>
  )
}

// -- Export helper ----

async function exportDashboard(gridRef: React.RefObject<HTMLDivElement | null>, format: 'png' | 'pdf') {
  if (!gridRef.current) return
  const { default: html2canvas } = await import('html2canvas-pro')
  const canvas = await html2canvas(gridRef.current, { backgroundColor: '#f8fafc', scale: 2, useCORS: true })

  if (format === 'png') {
    const link = document.createElement('a')
    link.download = `dashboard-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } else {
    const imgData = canvas.toDataURL('image/png')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Dashboard Export</title><style>@media print { @page { margin: 0.5cm; size: landscape; } body { margin: 0; } img { width: 100%; height: auto; } }</style></head><body><img src="${imgData}" /><script>setTimeout(()=>{window.print();window.close()},300)</script></body></html>`)
    w.document.close()
  }
}

// -- Seeding ----

function buildSeedCharts(data: CustomDashboardData): Omit<PinnedChart, 'pinnedAt'>[] {
  const recent = data.revenue_trend.slice(-6)
  return [
    { id: crypto.randomUUID(), title: 'Revenue Trend', headers: ['Month', 'Revenue'], rows: data.revenue_trend.map((d) => [d.month, String(d.revenue)]), chartType: 'line', sourceQuestion: 'demo', x: 0, y: 0, w: 888, h: 312 },
    { id: crypto.randomUUID(), title: 'Lifecycle Stage Distribution', headers: ['Stage', 'Count'], rows: data.lifecycle_distribution.map((d) => [d.stage, String(d.count)]), chartType: 'pie', sourceQuestion: 'demo', x: 912, y: 0, w: 432, h: 312 },
    { id: crypto.randomUUID(), title: 'Leads vs Customers', headers: ['Month', 'Leads', 'Customers'], rows: data.leads_customers_trend.map((d) => [d.month, String(d.leads), String(d.customers)]), chartType: 'bar', sourceQuestion: 'demo', x: 0, y: 336, w: 576, h: 312 },
    { id: crypto.randomUUID(), title: 'Recent Revenue (Last 6M)', headers: ['Month', 'Revenue'], rows: recent.map((d) => [d.month, String(d.revenue)]), chartType: 'area', sourceQuestion: 'demo', x: 600, y: 336, w: 744, h: 312 },
  ]
}

// -- Styles ----

const PAGE_STYLES = `
  .dot-grid-page {
    background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
    background-size: 24px 24px;
    min-height: calc(100vh - 100px);
  }
  .grid-canvas {
    border: 2px dashed rgba(148, 163, 184, 0.25);
    border-radius: 12px;
    padding: 6px;
    transition: border-color 200ms;
  }
  .grid-canvas:hover {
    border-color: rgba(148, 163, 184, 0.45);
  }
  /* Raise dragged chart above others */
  .react-draggable-dragging { z-index: 100 !important; }
  /* react-resizable handles */
  .react-resizable { position: relative; }
  .react-resizable-handle {
    position: absolute;
    width: 14px;
    height: 14px;
    z-index: 2;
  }
  .react-resizable-handle::after {
    content: "";
    position: absolute;
    width: 6px;
    height: 6px;
    border-right: 2px solid rgba(0,0,0,0.25);
    border-bottom: 2px solid rgba(0,0,0,0.25);
  }
  .react-resizable-handle-se { bottom: 2px; right: 2px; cursor: se-resize; }
  .react-resizable-handle-se::after { bottom: 2px; right: 2px; }
  .react-resizable-handle-sw { bottom: 2px; left: 2px; cursor: sw-resize; }
  .react-resizable-handle-sw::after { bottom: 2px; left: 2px; transform: rotate(90deg); }
  .react-resizable-handle-ne { top: 2px; right: 2px; cursor: ne-resize; }
  .react-resizable-handle-ne::after { top: 2px; right: 2px; transform: rotate(-90deg); }
  .react-resizable-handle-nw { top: 2px; left: 2px; cursor: nw-resize; }
  .react-resizable-handle-nw::after { top: 2px; left: 2px; transform: rotate(180deg); }
  .react-resizable-handle-n { top: 0; left: 50%; margin-left: -7px; cursor: n-resize; }
  .react-resizable-handle-n::after { bottom: 2px; right: 2px; }
  .react-resizable-handle-s { bottom: 0; left: 50%; margin-left: -7px; cursor: s-resize; }
  .react-resizable-handle-s::after { bottom: 2px; right: 2px; }
  .react-resizable-handle-e { right: 0; top: 50%; margin-top: -7px; cursor: e-resize; }
  .react-resizable-handle-e::after { bottom: 2px; right: 2px; }
  .react-resizable-handle-w { left: 0; top: 50%; margin-top: -7px; cursor: w-resize; }
  .react-resizable-handle-w::after { bottom: 2px; right: 2px; transform: rotate(90deg); }
`

// -- Main page ----

function CustomDashboardContent() {
  const dashboards = useDashboards()
  const [activeId, setActiveId] = useState('')
  const { data: apiData, isSuccess: apiReady } = useCustomDashboardData()
  const exportAreaRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!exportAreaRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width)
    })
    ro.observe(exportAreaRef.current)
    setContainerWidth(exportAreaRef.current.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setActiveId(getActiveDashboardId())
    const handler = () => setActiveId(getActiveDashboardId())
    window.addEventListener('demo-dashboards-changed', handler)
    return () => window.removeEventListener('demo-dashboards-changed', handler)
  }, [])

  useEffect(() => {
    if (apiReady && apiData) {
      const seeded = isDashboardSeeded()
      const all = JSON.parse(localStorage.getItem('demo-dashboards') || '[]')
      const db = all[0]
      const hasOldUnits = db?.charts?.length > 0 && db.charts[0].w < 50
      const needsReseed = !seeded || !db || db.charts.length < 4 || hasOldUnits
      if (needsReseed) {
        localStorage.removeItem('demo-dashboard-seeded')
        seedDemoCharts(buildSeedCharts(apiData))
      }
    }
  }, [apiReady, apiData])

  const [sidebarMode, setSidebarMode] = useState<SidebarMode | 'closed'>('closed')
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [selectedCanvasChartId, setSelectedCanvasChartId] = useState<string | null>(null)

  const activeDashboard = dashboards.find((d) => d.id === activeId) ?? dashboards[0]
  const allCharts = activeDashboard?.charts ?? []
  const charts = allCharts.filter((c): c is PinnedChart => !('configId' in c))

  const handleDragStop = useCallback((id: string, x: number, y: number) => {
    if (!activeDashboard) return
    const updated = allCharts.map((c) => ({ i: c.id, x: c.id === id ? x : c.x, y: c.id === id ? y : c.y, w: c.w, h: c.h }))
    updateAllLayouts(activeDashboard.id, updated)
  }, [activeDashboard, allCharts])

  const handleResizeStop = useCallback((id: string, x: number, y: number, w: number, h: number) => {
    if (!activeDashboard) return
    const updated = allCharts.map((c) => c.id === id
      ? { i: c.id, x, y, w, h }
      : { i: c.id, x: c.x, y: c.y, w: c.w, h: c.h }
    )
    updateAllLayouts(activeDashboard.id, updated)
  }, [activeDashboard, allCharts])

  const handleExport = async (format: 'png' | 'pdf') => {
    setExporting(true)
    try { await exportDashboard(exportAreaRef, format) } finally { setExporting(false) }
  }

  const chartsBottom = allCharts.reduce((max, c) => Math.max(max, c.y + c.h), 0)
  const [extraHeight, setExtraHeight] = useState(0)
  const canvasHeight = Math.max(chartsBottom + SNAP, chartsBottom + extraHeight)
  const canvasResizingRef = useRef(false)
  const canvasResizeStartRef = useRef({ y: 0, h: 0 })

  const handleCanvasResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    canvasResizingRef.current = true
    canvasResizeStartRef.current = { y: e.clientY, h: extraHeight }
    const onMove = (ev: MouseEvent) => {
      if (!canvasResizingRef.current) return
      const delta = ev.clientY - canvasResizeStartRef.current.y
      setExtraHeight(Math.max(0, snap(canvasResizeStartRef.current.h + delta)))
    }
    const onUp = () => {
      canvasResizingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [extraHeight])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_STYLES + `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }` }} />

      <div className="dot-grid-page" style={{ marginRight: sidebarMode !== 'closed' ? 320 : 0, transition: 'margin-right 250ms ease' }}>
        <div className="container-page py-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {dashboards.length > 0 && <DashboardTabs dashboards={dashboards} activeId={activeId} />}
            </div>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button
                onClick={() => { setEditingConfigId(null); setSelectedCanvasChartId(null); setSidebarMode('new') }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-brand-primary text-white hover:opacity-90 transition-all duration-150"
              >
                <PlusCircle size={13} /> Build Chart
              </button>
              <button
                onClick={() => setSidebarMode((m) => m === 'library' ? 'closed' : 'library')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-150 ${sidebarMode === 'library' ? 'bg-brand-secondary text-white border-brand-secondary' : 'bg-white border-border text-brand-secondary/70 hover:text-brand-secondary hover:border-brand-secondary/40'}`}
              >
                <BookOpen size={13} /> Library
              </button>
              {allCharts.length > 0 && (
                <>
                  <button onClick={() => handleExport('png')} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-border text-brand-secondary/70 hover:text-brand-secondary hover:border-brand-secondary/40 transition-all duration-150 disabled:opacity-50">
                    <Image size={13} /> PNG
                  </button>
                  <button onClick={() => handleExport('pdf')} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-border text-brand-secondary/70 hover:text-brand-secondary hover:border-brand-secondary/40 transition-all duration-150 disabled:opacity-50">
                    <Download size={13} /> PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Grid canvas */}
          <div className="grid-canvas" ref={exportAreaRef} style={{ position: 'relative', height: canvasHeight, transition: 'height 80ms ease' }}>
            {allCharts.length === 0 ? (
              <motion.div className="flex flex-col items-center justify-center py-32 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-14 h-14 rounded-full bg-white/80 flex items-center justify-center mb-4 shadow-sm border border-border">
                  <LayoutGrid size={28} className="text-brand-primary" />
                </div>
                <h3 className="text-base font-semibold text-brand-secondary mb-2">No charts yet</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  {apiReady ? 'Use "Build Chart" to create a chart, or wait for demo charts to load.' : 'Loading demo charts from the API...'}
                </p>
              </motion.div>
            ) : (
              allCharts.map((chart) =>
                'configId' in chart ? (
                  <DynamicChartContent
                    key={chart.id}
                    configId={chart.configId}
                    chartId={chart.id}
                    others={allCharts.filter((c) => c.id !== chart.id)}
                    containerWidth={containerWidth}
                    onDragStop={handleDragStop}
                    onResizeStop={handleResizeStop}
                    x={chart.x} y={chart.y} w={chart.w} h={chart.h}
                    pinnedAt={chart.pinnedAt}
                    isSelected={selectedCanvasChartId === chart.id}
                    onSelect={(id) => {
                      setSelectedCanvasChartId(id)
                      setEditingConfigId(chart.configId)
                      setSidebarMode('edit')
                    }}
                  />
                ) : (
                  <ChartItem
                    key={chart.id}
                    chart={chart as PinnedChart}
                    others={charts.filter((c) => c.id !== chart.id)}
                    containerWidth={containerWidth}
                    onDragStop={handleDragStop}
                    onResizeStop={handleResizeStop}
                  />
                )
              )
            )}
          </div>

          {/* Bottom drag handle */}
          {allCharts.length > 0 && (
            <div
              onMouseDown={handleCanvasResizeStart}
              style={{ height: 10, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, userSelect: 'none' }}
              title="Drag to expand"
            >
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.4)', transition: 'background 150ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(9,124,247,0.5)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(148,163,184,0.4)')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Chart builder sidebar */}
      <AnimatePresence>
        {sidebarMode !== 'closed' && (
          <ChartBuilderSidebar
            mode={sidebarMode}
            editingConfigId={editingConfigId}
            activeId={activeId}
            onClose={() => { setSidebarMode('closed'); setEditingConfigId(null); setSelectedCanvasChartId(null) }}
            onSwitchMode={(m) => { setSidebarMode(m); if (m !== 'edit') setEditingConfigId(null) }}
            onEditConfig={(configId) => { setEditingConfigId(configId); setSidebarMode('edit') }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default function CustomDashboardPage() {
  return (
    <Suspense>
      <CustomDashboardContent />
    </Suspense>
  )
}
```

---

## NavTabs Update

Add `{ label: 'My Dashboards', href: '/custom' }` as the **last** tab in NavTabs, just before the AI Assistant tab (or at the end if no AI):

```typescript
{ label: 'My Dashboards', href: '/custom' },
```

---

## Design Notes

- Canvas uses a 24px dot grid (`background-size: 24px 24px`)
- Charts snap to 24px grid on drag and resize stop
- Magnetic snap: charts align to adjacent chart edges with 1-dot gap
- Min chart size: 144x96px; default new chart: 600x300px
- Export: PNG via `html2canvas-pro` at 2x scale; PDF via print dialog
- **Colors:** Import chart palette from `COLORS.chart` in `lib/constants.ts` (defined in design-tokens.md)
- **Typography:** Use `var(--font-sans)` (app's configured font) for all labels and pills
- **Z-index:** Fullscreen portals use `z-[998]` (below KaiWidget at 996-997, but above everything else)
- **Empty state:** Always provide clear instructions pointing to KAI for pinning charts
- **Persistence:** All state is client-side localStorage — no backend endpoints needed
