/*
 * API RESPONSE TYPES
 *
 * One interface per endpoint response. Keep in sync with backend.
 * CUSTOMIZE: Add your data types below.
 */

export interface HealthResponse {
  status: string
}

export interface PlatformInfo {
  connection_url: string | null
  project_id: string | null
}

export interface UserMeResponse {
  email: string
  role: string
  is_authenticated: boolean
}

/*
 * CUSTOMIZE: Add your data types. Examples:
 *
 * export interface KpiResponse {
 *   total_revenue: number
 *   growth_rate: number
 *   active_users: number
 *   delta_revenue_pct: number
 * }
 *
 * export interface TrendPoint {
 *   label: string
 *   current: number
 *   previous: number
 * }
 *
 * export interface ListItem {
 *   id: string
 *   name: string
 *   category: string
 *   value: number
 *   change_pct: number
 * }
 */
