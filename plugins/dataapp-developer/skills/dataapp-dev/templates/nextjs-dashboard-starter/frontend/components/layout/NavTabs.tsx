'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

// CUSTOMIZE: Define your navigation tabs
const TABS = [
  {
    label: 'Dashboard',
    href: '/',
    icon: (active: boolean) => (
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: active ? 1 : 0.6 }}>
        <polyline points="1,9 3.5,5.5 6,7 9.5,2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  // CUSTOMIZE: Add more tabs as needed
  // {
  //   label: 'Details',
  //   href: '/details',
  //   icon: (active: boolean) => (
  //     <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: active ? 1 : 0.6 }}>
  //       <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
  //       <path d="M3.5 4H7.5M3.5 6.5H6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  //     </svg>
  //   ),
  // },
]

export default function NavTabs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const period = searchParams.get('period') ?? 'l12m'
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Only show nav tabs if there are multiple tabs
  if (TABS.length <= 1) return null

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.6)',
        boxShadow: '0 1px 8px -2px rgba(9, 124, 247, 0.06), inset 0 -1px 0 rgba(255,255,255,0.5)',
        position: 'sticky',
        top: 56,
        zIndex: 20,
        height: 44,
      }}
    >
      <div className="flex items-center justify-between px-6 h-full">
        {/* Tab links */}
        <div className="flex items-center gap-0.5">
          {TABS.map(tab => {
            const isActive =
              tab.href === '/'
                ? pathname === '/'
                : pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.href}
                href={`${tab.href}?period=${period}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 7,
                  fontSize: '0.84rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#002151' : 'rgba(0,33,81,0.5)',
                  background: isActive ? 'rgba(9,124,247,0.08)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(9,124,247,0.18)' : 'transparent'}`,
                  transition: 'all 150ms ease',
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                  letterSpacing: '0.01em',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(9,124,247,0.05)'
                    ;(e.currentTarget as HTMLElement).style.color = 'rgba(0,33,81,0.75)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'rgba(0,33,81,0.5)'
                  }
                }}
              >
                {tab.icon(isActive)}
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
