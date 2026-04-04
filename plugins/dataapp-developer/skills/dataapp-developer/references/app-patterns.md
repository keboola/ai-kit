# Next.js / React Patterns

Architecture and patterns for building Next.js data apps on Keboola.

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router) | SSR, file-based routing, standalone Docker output |
| UI | React 19 | Component model, hooks |
| Styling | Tailwind CSS 4 | Design tokens via `@theme`, utility classes |
| Charts | ECharts (apache-echarts) | Registered themes, rich chart types, performant |
| Animation | Framer Motion | Stagger, springs, AnimatePresence |
| Data fetching | @tanstack/react-query | Cache, staleTime, placeholderData, persistence |
| Fonts | Plus Jakarta Sans, JetBrains Mono | via `next/font/google` |
| Backend | FastAPI (Python) | Data proxy, API endpoints |

## package.json Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "echarts": "^5.5.0",
    "echarts-for-react": "^3.0.0",
    "framer-motion": "^11.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-table": "^8.21.0",
    "lucide-react": "^0.500.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.0.0",
    "@types/react": "^19.0.0",
    "@types/node": "^22.0.0"
  }
}
```

## Next.js Configuration

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Docker/Keboola deployment
  async rewrites() {
    // Local dev only: proxy /api/* to FastAPI on :8050
    // In production, Nginx handles this routing
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8050/api/:path*',
      },
    ]
  },
}

export default nextConfig
```

## Root Layout

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Providers from './providers'

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

// CUSTOMIZE: Replace with your app's metadata
export const metadata: Metadata = {
  title: 'My Dashboard',
  description: 'Keboola Data App',
  icons: { icon: '/keboola-icon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`}>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

## Data Fetching Patterns

Two backend strategies are available:

- **Load at startup** (default template pattern) — loads all data into pandas DataFrames via `requests.get()` during startup, serves computed results from memory. Best for dashboards with stable datasets.
- **Live query proxy** (shown below) — proxies SQL queries to Keboola workspace API in real time via `httpx.AsyncClient`. Best for apps that need dynamic, user-driven queries.

The starter template uses the load-at-startup pattern. The live query proxy pattern below is an alternative for apps that need real-time data access.

### Backend API Proxy (FastAPI — Live Query Pattern)

The backend proxies Keboola workspace queries so credentials stay server-side:

```python
# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx, os

from contextlib import asynccontextmanager

# Persistent HTTP client — reuses TCP connections across requests
_http_client: httpx.AsyncClient | None = None

@asynccontextmanager
async def lifespan(app):
    global _http_client
    _http_client = httpx.AsyncClient(timeout=60.0)
    yield
    await _http_client.aclose()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

KBC_URL = os.environ.get("KBC_URL", "")
KBC_TOKEN = os.environ.get("KBC_TOKEN", "")

def get_http_client() -> httpx.AsyncClient:
    assert _http_client is not None, "HTTP client not initialized"
    return _http_client

@app.post("/api/query")
async def query(body: dict):
    client = get_http_client()
    resp = await client.post(
        f"{KBC_URL}/v2/storage/workspaces/{os.environ.get('KBC_WORKSPACE_ID', '')}/query",
        headers={"X-StorageApi-Token": KBC_TOKEN, "Content-Type": "application/json"},
        json={"query": body["sql"]},
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()
```

### Frontend React Query Hooks

```typescript
// lib/api.ts
'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

/** Standard useQuery wrapper — 5 min staleTime + keepPreviousData. */
function useStandardQuery<T>(queryKey: unknown[], url: string) {
  return useQuery<T>({
    queryKey,
    queryFn: () => apiFetch(url),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}

// CUSTOMIZE: Add your data hooks
export function useKpis(period: string) {
  return useStandardQuery(['kpis', period], `/api/kpis?period=${period}`)
}

export function useTrends(period: string) {
  return useStandardQuery(['trends', period], `/api/trends?period=${period}`)
}

export function useItems(period: string) {
  return useStandardQuery(['items', period], `/api/items?period=${period}`)
}
```

## Page Pattern

Note: The template uses a shared `(dashboard)/layout.tsx` that renders Header + NavTabs once.
Individual pages do NOT import Header/NavTabs — they just render their content.
The example below shows a self-contained page pattern for reference.

```typescript
// app/(dashboard)/page.tsx
'use client'

import { Suspense } from 'react'
import { motion } from 'framer-motion'
// Header + NavTabs come from (dashboard)/layout.tsx — do NOT import here
import FilterBar from '@/components/layout/FilterBar'
import KpiCard from '@/components/kpi/KpiCard'
import LoadingScreen from '@/components/layout/LoadingScreen'
import { useKpis, useTrends } from '@/lib/api'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
}

export default function DashboardPage() {
  const { data: kpis, isLoading } = useKpis('l3m')

  if (isLoading) return <LoadingScreen progress={0.5} onComplete={() => {}} />

  return (
    <main className="relative z-1 pt-[100px] px-6 pb-8">  {/* Header + NavTabs injected by (dashboard)/layout.tsx */}
        <FilterBar />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {/* CUSTOMIZE: KPI cards */}
          <motion.div variants={fadeUp}>
            <KpiCard label="Users" value={kpis.users} format="number" />
          </motion.div>
          <motion.div variants={fadeUp}>
            <KpiCard label="Events" value={kpis.events} format="number" />
          </motion.div>
        </motion.div>

        {/* CUSTOMIZE: Charts section */}
    </main>
  )
}
```

## Keboola Deployment

For all Keboola deployment config (Nginx, Supervisord, setup.sh, pyproject.toml, environment variables, common errors, and deployment checklist), see `deployment.md`.

## SSE Performance Patterns

For SSE streaming performance, consider: rAF-batched deltas, dev proxy bypass, ChatMessage memoization, and debounced scroll.

## SQL Best Practices

Always:
- **Aggregate in database**, not in JavaScript
- **Use fully qualified table names** from Keboola schemas
- **Quote all identifiers**: `"column_name"`
- **Add date filters** on time-series queries
- **Check SQL dialect** (Snowflake vs BigQuery) with `{MCP_TOOL_PREFIX}get_project_info`

---

## Data Schema + Query Endpoints

Backend router for the **My Dashboards** chart builder. Provides `/api/data-schema` (returns available sources, dimensions, measures for the sidebar) and `/api/query-data` (executes grouped aggregation queries). The Frontend Agent creates the chart builder UI that consumes these endpoints.

**ADAPT SCHEMA and DATA_SCHEMA_RESPONSE** to match actual app tables from `TABLE_IDS`:

```python
from __future__ import annotations
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Query
from services.data_loader import _DATA
import pandas as pd

router = APIRouter()

# ADAPT: fill in for each table in TABLE_IDS
# For each table define: date_col (str|None), dimensions (set), measures (dict column->agg),
# supports_period (bool). Use 'sum' for flows, 'mean' for rates.
SCHEMA = {
    "table_short_name": {
        "date_col": "date_column",          # or None
        "dimensions": {"dimension_col"},
        "measures": {
            "measure_col_1": "sum",
            "measure_col_2": "mean",
        },
        "supports_period": True,            # False if no date_col
    },
    # ... repeat for each table
}

# ADAPT: human-readable version of SCHEMA for the frontend sidebar
DATA_SCHEMA_RESPONSE = {
    "sources": [
        {
            "id": "table_short_name",
            "label": "Human-readable Table Name",
            "dimensions": [{"column": "dimension_col", "label": "Dimension Label", "is_date": True}],
            "measures": [{"column": "measure_col_1", "label": "Measure 1"}, {"column": "measure_col_2", "label": "Measure 2"}],
            "supports_period": True,
        },
    ]
}


def _filter_period(df: pd.DataFrame, date_col: str, period: str | None) -> pd.DataFrame:
    if period is None or date_col not in df.columns: return df
    try:
        dates = pd.to_datetime(df[date_col], errors="coerce")
        latest = dates.max()
        if pd.isna(latest): return df
        ref = latest.date() if hasattr(latest, "date") else latest
        if period == "L3M": cutoff = ref - timedelta(days=90)
        elif period == "L6M": cutoff = ref - timedelta(days=180)
        elif period == "YTD": cutoff = date(ref.year, 1, 1)
        elif period == "12M": cutoff = ref - timedelta(days=365)
        else: return df
        return df.loc[pd.to_datetime(df[date_col], errors="coerce").dt.date >= cutoff]
    except Exception: return df


@router.get("/api/data-schema")
def get_data_schema():
    return DATA_SCHEMA_RESPONSE


@router.get("/api/query-data")
def query_data(
    source: str = Query(...),
    dimension: str = Query(...),
    measures: str = Query(...),
    period: str | None = Query(default=None),
):
    if source not in SCHEMA:
        raise HTTPException(status_code=422, detail=f"Invalid source: {source}")
    schema = SCHEMA[source]
    if dimension not in schema["dimensions"]:
        raise HTTPException(status_code=422, detail=f"Invalid dimension '{dimension}'")
    measure_list = [m.strip() for m in measures.split(",") if m.strip()]
    if not measure_list:
        raise HTTPException(status_code=422, detail="At least one measure required")
    invalid = [m for m in measure_list if m not in schema["measures"]]
    if invalid:
        raise HTTPException(status_code=422, detail=f"Invalid measures: {invalid}")

    df = _DATA.get(source)
    if df is None or df.empty:
        return {"headers": [dimension] + measure_list, "rows": []}

    # Virtual 'count' measure
    if measure_list == ["count"] and "count" not in df.columns:
        result = df.groupby(dimension).size().reset_index(name="count")
        rows = [[str(r[dimension]), str(r["count"])] for _, r in result.iterrows()]
        return {"headers": [dimension, "count"], "rows": rows}

    date_col = schema["date_col"]
    if schema["supports_period"] and period and date_col:
        df = _filter_period(df, date_col, period)

    missing = [c for c in [dimension] + measure_list if c not in df.columns]
    if missing:
        raise HTTPException(status_code=422, detail=f"Columns not found: {missing}")

    df = df.copy()
    if dimension == date_col and date_col:
        df[dimension] = pd.to_datetime(df[dimension], errors="coerce").dt.to_period("M").astype(str)

    agg_dict = {m: schema["measures"][m] for m in measure_list}
    grouped = df.groupby(dimension, sort=True).agg(agg_dict).reset_index()
    headers = [dimension] + measure_list
    rows = [[str(r[dimension])] + [f"{r[m]:.2f}" if isinstance(r[m], float) else str(r[m]) for m in measure_list] for _, r in grouped.iterrows()]
    return {"headers": headers, "rows": rows}
```

In `backend/main.py`, add after existing router imports:
```python
from routers import query
app.include_router(query.router)
```
