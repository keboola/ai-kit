// CUSTOMIZE: Define TypeScript interfaces matching your FastAPI response schemas

/** KPI summary for the dashboard header cards */
export interface KpiResponse {
  total_revenue: number
  growth_rate: number              // percentage 0–100
  active_users: number
  conversion_rate: number          // percentage 0–100
  margin_pct: number               // percentage 0–100
  delta_revenue_pct: number | null // vs comparison period; null = unavailable
  delta_growth_pct: number | null
  delta_users_pct: number | null
  delta_conversion_pct: number | null
}

/** Time-series trend data for charts */
export interface TrendResponse {
  labels: string[]                 // ["Jan 2025", "Feb 2025", ...]
  values_current: number[]         // current period values
  values_previous: number[]        // comparison period values
}

/** Individual item in the data table */
export interface ListItem {
  id: string
  name: string
  category: string
  value: number
  change_pct: number               // percentage change
  count: number
}

/** User info from /api/me */
export interface UserMeResponse {
  email: string | null
  role: string
  is_admin: boolean
}
