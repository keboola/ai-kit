'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'

/*
 * NAVIGATION TABS — Sticky below header (44px, z-20).
 *
 * TO ADD A PAGE:
 *   1. Add entry to TABS (label, href, icon)
 *   2. Create route file: app/<path>/page.tsx
 *   3. Tab auto-highlights based on URL
 *
 * ICONS: https://lucide.dev — import { Users, TrendingUp } from 'lucide-react'
 */
const TABS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  /* CUSTOMIZE: Add more tabs
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Trends', href: '/trends', icon: TrendingUp },
  */
]

export default function NavTabs() {
  const pathname = usePathname()

  return (
    <nav
      className="sticky top-[56px] z-20 border-b border-border bg-white"
      style={{ height: 44 }}
    >
      <div className="container-page h-full flex items-center gap-1">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm
                transition-colors duration-150
                ${isActive
                  ? 'font-semibold text-brand-primary bg-brand-primary/5'
                  : 'text-gray-500 hover:text-brand-secondary hover:bg-gray-50'
                }
              `}
            >
              <Icon size={15} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
