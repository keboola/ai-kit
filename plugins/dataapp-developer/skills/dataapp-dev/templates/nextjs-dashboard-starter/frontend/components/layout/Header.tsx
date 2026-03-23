'use client'

import { useCurrentUser } from '@/lib/api'
import { useState, useRef, useEffect } from 'react'

interface HeaderProps {
  // CUSTOMIZE: Replace default title with your app's title
  title?: string
  minimal?: boolean
}

export default function Header({
  title = 'Keboola Dashboard' /* CUSTOMIZE: Replace with your app name */,
  minimal = false,
}: HeaderProps) {
  const { data: me } = useCurrentUser()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileOpen) return
    function onMouseDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [profileOpen])

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.6)',
        boxShadow: '0 1px 8px -2px rgba(9, 124, 247, 0.08)',
      }}
    >
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-3">
        {/* CUSTOMIZE: Replace with your logo or icon */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #097cf7 0%, #002151 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 12L6 6L9 8.5L14 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1
          style={{
            fontSize: minimal ? '0.92rem' : '1.05rem',
            fontWeight: 800,
            color: '#001029',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
      </div>

      {/* Right: User profile */}
      <div ref={profileRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setProfileOpen(p => !p)}
          className="flex items-center gap-2 cursor-pointer"
          style={{
            padding: '6px 12px',
            borderRadius: 10,
            border: '1px solid rgba(226, 232, 240, 0.6)',
            background: profileOpen ? 'rgba(9, 124, 247, 0.06)' : 'transparent',
            transition: 'all 150ms ease',
          }}
        >
          {/* Avatar circle */}
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #097cf7 0%, #002151 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          >
            {me?.email ? me.email[0].toUpperCase() : '?'}
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#002151' }}>
            {me?.email ?? 'Loading...'}
          </span>
        </button>

        {/* Profile dropdown */}
        {profileOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              background: '#fff',
              border: '1px solid rgba(226, 232, 240, 0.6)',
              borderRadius: 12,
              boxShadow: '0 12px 40px -8px rgba(0,0,0,0.12)',
              padding: '12px 16px',
              minWidth: 200,
              zIndex: 50,
            }}
          >
            <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#002151' }}>
              {me?.email ?? '—'}
            </p>
            <p style={{ fontSize: '0.65rem', color: 'rgba(0, 33, 81, 0.5)', marginTop: 2 }}>
              {me?.role ?? 'user'}
            </p>
          </div>
        )}
      </div>
    </header>
  )
}
