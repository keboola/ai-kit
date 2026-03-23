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
| Backend | FastAPI (Python) or Express (Node) | Data proxy, Kai proxy |

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
  icons: { icon: '/favicon.svg' },
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

## Data Fetching Pattern (React Query + Backend Proxy)

### Backend API Proxy (FastAPI)

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

```typescript
// app/page.tsx
'use client'

import { Suspense } from 'react'
import { motion } from 'framer-motion'
import Header from '@/components/layout/Header'
import NavTabs from '@/components/layout/NavTabs'
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
    <>
      <Header />
      <NavTabs />
      <main className="relative z-1 pt-[100px] px-6 pb-8">
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
    </>
  )
}
```

## Keboola Deployment

### next.config.ts

`output: 'standalone'` is required — it produces a self-contained `.next/standalone` directory.

### keboola-config/nginx/sites/default.conf

```nginx
server {
    listen 8888;

    # Next.js frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8050;
        proxy_http_version 1.1;
        proxy_set_header Host $host;

        # SSE support (for Kai streaming)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
    }
}
```

### keboola-config/supervisord/services/

**node.conf** (Next.js):
```ini
[program:frontend]
command=node /app/frontend/.next/standalone/server.js
directory=/app/frontend/.next/standalone
autostart=true
autorestart=true
environment=PORT="3000",HOSTNAME="0.0.0.0"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

**python.conf** (FastAPI backend):
```ini
[program:backend]
command=uv run uvicorn backend.main:app --host 0.0.0.0 --port 8050
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

### keboola-config/setup.sh

```bash
#!/bin/bash
set -Eeuo pipefail

# Install Python backend dependencies
cd /app/backend && uv sync

# Next.js is pre-built and committed — no npm build at startup
```

## SQL Best Practices

Same as Streamlit patterns — always:
- **Aggregate in database**, not in JavaScript
- **Use fully qualified table names** from Keboola schemas
- **Quote all identifiers**: `"column_name"`
- **Add date filters** on time-series queries
- **Check SQL dialect** (Snowflake vs BigQuery) with `{MCP_TOOL_PREFIX}get_project_info`
