'use client'

import React, { startTransition, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

// CUSTOMIZE: Define your time period options
const QUICK_PERIODS = [
  { value: 'l12m', label: '12M' },
  { value: 'ytd',  label: 'YTD' },
  { value: 'l3m',  label: 'L3M' },
  { value: 'l6m',  label: 'L6M' },
  { value: 'lq',   label: 'LQ'  },
  { value: 'lm',   label: 'LM'  },
  { value: 'cm',   label: 'CM'  },
]

interface FilterBarProps {
  period: string
  rightSlot?: React.ReactNode
}

export default function FilterBar({ period, rightSlot }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setPeriod = useCallback((val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', val)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }, [searchParams, pathname, router])

  return (
    <div
      className="sticky z-10 flex items-center px-5 min-w-0"
      style={{
        top: 100,
        height: 44,
        background: 'rgba(248, 250, 252, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.45)',
        boxShadow: '0 1px 4px -1px rgba(9, 124, 247, 0.04)',
        maxWidth: '100%',
        overflowX: 'clip',
      }}
    >
      {/* ── Period selector ── */}
      <GroupLabel>PERIOD</GroupLabel>

      <div
        className="scrollbar-none flex items-center gap-1"
        style={{ overflowX: 'auto', minWidth: 0, flexShrink: 1 }}
      >
        {QUICK_PERIODS.map(opt => (
          <PeriodPill
            key={opt.value}
            value={opt.value}
            label={opt.label}
            active={period === opt.value}
            onClick={() => setPeriod(opt.value)}
          />
        ))}
      </div>

      {/* CUSTOMIZE: Add additional filter controls in rightSlot */}
      {rightSlot && (
        <>
          <div style={{ flex: 1 }} />
          <Divider />
          {rightSlot}
        </>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="shrink-0"
      style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: 'rgba(0, 33, 81,0.6)',
        marginRight: 6,
        userSelect: 'none',
      }}
    >
      {children}
    </span>
  )
}

function Divider() {
  return (
    <div
      className="shrink-0"
      style={{ width: 1, height: 14, background: 'rgba(9, 124, 247,0.12)', margin: '0 6px' }}
    />
  )
}

function PeriodPill({
  label, active, onClick, value,
}: { label: string; active: boolean; onClick: () => void; value: string }) {
  return (
    <button
      data-period={value}
      onClick={onClick}
      className="shrink-0 cursor-pointer"
      style={{
        padding: '4px 10px',
        borderRadius: 7,
        fontSize: '0.82rem',
        fontWeight: active ? 700 : 500,
        letterSpacing: '0.03em',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        transition: 'color 150ms ease, font-weight 150ms ease',
        background: 'transparent',
        color: active ? '#fff' : 'rgba(0, 33, 81,0.5)',
        border: '1px solid transparent',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {active && (
        <motion.div
          layoutId="period-pill-active"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 7,
            background: '#002151',
            boxShadow: '0 1px 4px rgba(0, 33, 81,0.25)',
            zIndex: -1,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
      {label}
    </button>
  )
}
