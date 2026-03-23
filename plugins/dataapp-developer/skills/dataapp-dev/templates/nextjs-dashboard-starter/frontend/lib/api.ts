'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type {
  KpiResponse,
  TrendResponse,
  ListItem,
  UserMeResponse,
} from './types'

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${url}`)
  }
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

// ─── Current user ─────────────────────────────────────────────────────────────

export function useCurrentUser() {
  return useQuery<UserMeResponse>({
    queryKey: ['me'],
    queryFn: () => apiFetch('/api/me'),
    staleTime: 10 * 60 * 1000,
  })
}

// ─── Platform info (Keboola connection URL, project ID) ──────────────────────

export interface PlatformInfo {
  connection_url: string
  project_id: string | null
  bucket: string
}

export function usePlatformInfo() {
  return useQuery<PlatformInfo>({
    queryKey: ['platform'],
    queryFn: () => apiFetch('/api/platform'),
    staleTime: 60 * 60 * 1000,
  })
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────
// CUSTOMIZE: Replace with your actual data hooks

export function useKpis(period: string) {
  return useStandardQuery<KpiResponse>(
    ['kpis', period],
    `/api/kpis?period=${period}`,
  )
}

// ─── Trends ───────────────────────────────────────────────────────────────────
// CUSTOMIZE: Replace with your actual trend data hook

export function useTrends(period: string) {
  return useStandardQuery<TrendResponse>(
    ['trends', period],
    `/api/trends?period=${period}`,
  )
}

// ─── List items ───────────────────────────────────────────────────────────────
// CUSTOMIZE: Replace with your actual list data hook

export function useItems(period: string) {
  return useStandardQuery<ListItem[]>(
    ['items', period],
    `/api/items?period=${period}`,
  )
}
