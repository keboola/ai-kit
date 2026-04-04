/*
 * COLOR TOKENS — mirrors globals.css @theme block.
 * Use COLORS for JS contexts (ECharts, inline styles, canvas).
 * Use Tailwind classes for CSS (bg-brand-primary, text-positive, etc.)
 *
 * TO REBRAND: Change here AND in globals.css @theme.
 */
export const COLORS = {
  brandPrimary:   '#097cf7',
  brandSecondary: '#002151',
  brandAccent:    '#ca8a04',
  surface:        '#f8fafc',
  border:         '#e2e8f0',
  positive:       '#16a34a',
  negative:       '#dc2626',
  warning:        '#f59e0b',
  bgWhite:        '#ffffff',
  chart: ['#097cf7', '#ca8a04', '#1e3a8a', '#059669', '#dc2626', '#8b5cf6'],
} as const

/*
 * NUMBER FORMATTERS — consistent display across the app.
 * import { formatCurrency, formatPercent, formatDelta, formatCount, formatCompact, formatNumber } from '@/lib/constants'
 */
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return formatCurrency(n)
}

/** Unsigned percentage — 1 decimal place. For deltas, use formatDelta(). */
export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

/** Signed delta — always shows + or –. Use for WoW/MoM change values. */
export function formatDelta(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

/** Comma-separated integer count. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}
