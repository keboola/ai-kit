'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { COLORS, formatCurrency, formatPercent, formatNumber } from '@/lib/constants'

// ─── Types & helpers ─────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: number
  format: 'currency' | 'percent' | 'number'
  delta?: number | null
  deltaLabel?: string
  isLoading?: boolean
  accentColor?: string
  sparkline?: number[]
  target?: number
  higherIsBetter?: boolean
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 80, h = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  const last = values[values.length - 1]
  const lastX = w
  const lastY = h - ((last - min) / range) * h
  const areaD = `M0,${h} ${pts.split(' ').map(p => `L${p}`).join(' ')} L${w},${h} Z`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`spark-fill-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-fill-${color.replace('#','')})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} opacity={0.9} />
    </svg>
  )
}

function formatValue(value: number, format: KpiCardProps['format']): string {
  switch (format) {
    case 'currency': return formatCurrency(value)
    case 'percent':  return formatPercent(value)
    case 'number':   return formatNumber(value)
    default: return String(value)
  }
}

const cardVariants = {
  hidden:  { opacity: 0, y: 18, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

export default function KpiCard({
  label,
  value,
  format,
  delta,
  deltaLabel,
  isLoading = false,
  accentColor = COLORS.brandPrimary,
  sparkline,
  target,
  higherIsBetter = true,
}: KpiCardProps) {
  const isPositive = delta === undefined || delta === null || delta >= 0

  const [displayValue, setDisplayValue] = useState(0)
  useEffect(() => {
    if (isLoading) return
    const duration = 800
    const start = performance.now()
    const from = 0
    const to = value
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(from + (to - from) * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, isLoading])

  const meetsTarget = target !== undefined
    ? (higherIsBetter ? value >= target : value <= target)
    : null

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="kpi-card rounded-2xl px-5 pt-5 pb-10 animate-pulse h-full"
        style={{
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(226, 232, 240, 0.5)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 16px -4px rgba(9,124,247,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
          minHeight: '10rem',
        }}
      >
        <div className="h-2 w-14 bg-brand-secondary/10 rounded-full mb-4" />
        <div className="h-9 w-28 bg-brand-secondary/10 rounded-lg mb-3" />
        <div className="h-4 w-20 bg-brand-secondary/10 rounded-full" />
      </div>
    )
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{
        y: -6,
        scale: 1.015,
        transition: { type: 'spring', stiffness: 400, damping: 20 }
      }}
      whileTap={{ scale: 0.98 }}
      className="kpi-card rounded-2xl px-5 pt-5 pb-10 h-full"
      style={{
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(226, 232, 240, 0.5)',
        boxShadow: `inset 0 3px 0 ${accentColor}, 0 1px 3px rgba(0,0,0,0.02), 0 4px 16px -4px rgba(9,124,247,0.06), inset 0 1px 0 rgba(255,255,255,0.9)`,
        position: 'relative',
        overflow: 'visible',
        minHeight: '10rem',
        zIndex: 'auto',
      }}
    >

      {/* Inner glow */}
      <div style={{
        position: 'absolute', top: -30, left: -30,
        width: 120, height: 120,
        background: `radial-gradient(circle, ${accentColor}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Accent dot + label */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        {delta != null && (
          <motion.span
            initial={{ y: delta >= 0 ? 4 : -4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            style={{ fontSize: '0.6rem', color: delta >= 0 ? '#16A34A' : '#DC2626', lineHeight: 1 }}
          >
            {delta >= 0 ? '\u2191' : '\u2193'}
          </motion.span>
        )}
        <p className="section-label">{label}</p>
      </div>

      <p
        className="stat-num text-[2.5rem] font-extrabold leading-none mb-2 tracking-tight"
        style={{ color: meetsTarget === null ? 'black' : meetsTarget ? COLORS.positive : COLORS.negative }}
      >
        {formatValue(displayValue, format)}
      </p>

      {/* Target badge */}
      {target !== undefined && meetsTarget !== null && (
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="inline-flex items-center gap-1 text-[0.75rem] font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: meetsTarget ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
              color: meetsTarget ? COLORS.positive : COLORS.negative,
            }}
          >
            TARGET {target}%
          </span>
        </div>
      )}

      {/* Delta badge */}
      {delta !== undefined && (
        <div
          className="flex items-center gap-2"
          style={{ position: 'absolute', bottom: 14, left: 20 }}
        >
          {delta === null ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(0, 33, 81,0.06)', color: 'rgba(0, 33, 81,0.4)' }}
            >
              N/A
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: isPositive ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                color: isPositive ? COLORS.positive : COLORS.negative,
              }}
            >
              <span style={{ fontSize: '0.68rem' }}>{isPositive ? '\u25B2' : '\u25BC'}</span>
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {deltaLabel && delta !== null && (
            <span className="text-xs truncate" style={{ color: 'rgba(0, 33, 81,0.6)' }}>
              {deltaLabel}
            </span>
          )}
        </div>
      )}

      {/* Sparkline */}
      {sparkline && sparkline.length > 1 && (
        <div style={{ position: 'absolute', bottom: 12, right: 12, opacity: 0.28, pointerEvents: 'none' }}>
          <Sparkline values={sparkline} color={accentColor} />
        </div>
      )}
    </motion.div>
  )
}

export const kpiGridVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.12 } },
}
