// ─── Color tokens ─────────────────────────────────────────────────────────────
// CUSTOMIZE: Replace with your brand colors
export const COLORS = {
  // CUSTOMIZE: Replace with your brand colors
  brandPrimary:   '#097cf7',  // Main accent: buttons, links, chart primary
  brandSecondary: '#002151',  // Dark: hover states, text emphasis
  brandAccent:    '#CA8A04',  // Secondary: success, profit, chart secondary

  // Surfaces
  surface:        '#f5f7fa',  // Card/sidebar backgrounds
  border:         '#e2e8f0',
  bgWhite:        '#FFFFFF',
  textPrimary:    '#000000',
  textSecondary:  '#002151',

  // Semantic
  positive:       '#16A34A',
  negative:       '#DC2626',
  warning:        '#f59e0b',

  // Chart palette — 6 colors for data series
  chart: ['#097cf7', '#CA8A04', '#1E3A8A', '#059669', '#DC2626', '#8b5cf6'],
} as const

// ─── ECharts theme ────────────────────────────────────────────────────────────
export const echartsTheme = {
  color: COLORS.chart,
  backgroundColor: COLORS.bgWhite,
  textStyle: { fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', color: COLORS.textPrimary },
  title:  { textStyle: { color: COLORS.textPrimary, fontSize: 16 } },
  legend: { textStyle: { color: COLORS.textPrimary } },
  grid:   { borderColor: COLORS.border },
  line:   { smooth: true, symbolSize: 6, lineStyle: { width: 2 } },
  categoryAxis: {
    axisLine:  { lineStyle: { color: COLORS.border } },
    axisLabel: { color: COLORS.textPrimary },
    splitLine: { lineStyle: { color: COLORS.surface } },
  },
  valueAxis: {
    axisLine:  { show: false },
    axisLabel: { color: COLORS.textSecondary },
    splitLine: { lineStyle: { color: COLORS.border } },
  },
  tooltip: {
    backgroundColor: COLORS.bgWhite,
    borderColor: COLORS.border,
    textStyle: { color: COLORS.textPrimary },
  },
}

// ─── Number formatters ────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${value < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `${value < 0 ? '-' : ''}$${(abs / 1_000).toFixed(0)}K`
  }
  return formatCurrency(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

export function formatDelta(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}
