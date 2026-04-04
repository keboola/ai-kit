'use client'

import Image from 'next/image'
import { useCurrentUser } from '@/lib/api'

/*
 * HEADER — Sticky top bar (56px, z-30).
 *
 * CUSTOMIZE:
 *   - Logo: replace /public/logo.svg with your own
 *   - Title: change the text below
 *   - User menu: expand the right side with avatar + dropdown
 *   - Glassmorphism: add "backdrop-blur-xl bg-white/70" to className
 */
export default function Header() {
  const { data: user } = useCurrentUser()

  return (
    <header
      className="sticky top-0 w-full border-b border-border bg-white z-30"
      style={{ height: 56 }}
    >
      <div className="container-page h-full flex items-center justify-between">
        {/* CUSTOMIZE: Logo and title */}
        <div className="flex items-center gap-3">
          <Image src="/logo.svg" alt="Logo" width={28} height={28} priority />
          <h1 className="text-lg font-semibold text-brand-secondary">
            Keboola Data App
          </h1>
        </div>

        {/* CUSTOMIZE: User info / menu */}
        {user?.email && (
          <span className="text-sm text-gray-400">{user.email}</span>
        )}
      </div>
    </header>
  )
}
