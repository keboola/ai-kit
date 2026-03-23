'use client'

import { formatCurrency, formatPercent, formatNumber } from '@/lib/constants'

interface StickyKpiItem {
  label: string
  value: number
  format: 'currency' | 'percent' | 'number'
  color: string
}

interface StickyKpiBarProps {
  items: StickyKpiItem[]
  isLoading?: boolean
}

function formatByType(value: number, format: StickyKpiItem['format']): string {
  switch (format) {
    case 'currency': return formatCurrency(value)
    case 'percent':  return formatPercent(value)
    case 'number':   return formatNumber(value)
    default: return String(value)
  }
}

export default function StickyKpiBar({ items, isLoading }: StickyKpiBarProps) {
  if (isLoading || items.length === 0) return null

  return (
    <div
      className="sticky z-[9] flex items-center justify-center gap-6"
      style={{
        top: 144, // 56 header + 44 navtabs + 44 filterbar
        height: 32,
        background: 'rgba(248, 250, 252, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.4)',
        boxShadow: '0 2px 8px -4px rgba(0,0,0,0.04)',
      }}
    >
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2">
          {i > 0 && <Dot />}
          <KpiMini label={item.label} value={formatByType(item.value, item.format)} color={item.color} />
        </div>
      ))}
    </div>
  )
}

function KpiMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(0,33,81,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 800, color, fontFamily: 'var(--font-mono), monospace' }}>{value}</span>
    </div>
  )
}

function Dot() {
  return <div className="w-[3px] h-[3px] rounded-full" style={{ background: 'rgba(0,33,81,0.15)' }} />
}
