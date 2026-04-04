'use client'

import { useQuery } from '@tanstack/react-query'
import type { HealthResponse, PlatformInfo, UserMeResponse } from './types'

/*
 * API HOOKS — React Query wrappers for backend endpoints.
 *
 * Pattern (from profitline-dashboard-js):
 *   - Central apiFetch<T>(url) helper with error handling
 *   - Each endpoint → one useXxx() hook
 *   - queryKey includes ALL filter params (for cache isolation)
 *   - keepPreviousData for smooth transitions when filters change
 *
 * HOW TO ADD A DATA HOOK:
 *   1. Define response type in lib/types.ts
 *   2. Add hook here:
 *        export function useKpis(period: string) {
 *          return useQuery<KpiResponse>({
 *            queryKey: ['kpis', period],
 *            queryFn: () => apiFetch(`/api/kpis?period=${period}`),
 *            placeholderData: keepPreviousData,
 *          })
 *        }
 *   3. Use in component: const { data, isLoading } = useKpis('ytd')
 */

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${url} — ${body}`)
  }
  return res.json()
}

// ─── Base hooks ─────────────────────────────────────────────────────────────

export function useHealthCheck() {
  return useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: () => apiFetch('/api/health'),
    staleTime: 30_000,
  })
}

export function useCurrentUser() {
  return useQuery<UserMeResponse>({
    queryKey: ['me'],
    queryFn: () => apiFetch('/api/me'),
    staleTime: 10 * 60 * 1000,
  })
}

export function usePlatformInfo() {
  return useQuery<PlatformInfo>({
    queryKey: ['platform'],
    queryFn: () => apiFetch('/api/platform'),
    staleTime: 60 * 60 * 1000,
  })
}

// ─── CUSTOMIZE: Add your data hooks below ───────────────────────────────────
