'use client'

import { Suspense, useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Header from '@/components/layout/Header'
import NavTabs from '@/components/layout/NavTabs'
import LoadingScreen from '@/components/layout/LoadingScreen'
import FilterBar from '@/components/layout/FilterBar'
import KpiCard, { kpiGridVariants } from '@/components/kpi/KpiCard'
import StickyKpiBar from '@/components/kpi/StickyKpiBar'
import TrendChart from '@/components/charts/TrendChart'
import DataTable from '@/components/tables/DataTable'
import { useKpis, useTrends, useItems, useCurrentUser } from '@/lib/api'
import { COLORS } from '@/lib/constants'

// CUSTOMIZE: Add your chart section stagger variants
const sectionVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}
const sectionCardVariants = {
  hidden:   { opacity: 0, y: 22 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
}

function LoadingSkeleton({ height }: { height: string }) {
  return (
    <div role="status" className={`${height} skeleton-shimmer rounded-lg`} />
  )
}

function DashboardContent() {
  const [loadingDone, setLoadingDone] = useState(false)

  const { data: me, isLoading: meLoading } = useCurrentUser()
  const searchParams = useSearchParams()
  const period = searchParams.get('period') ?? 'l12m'

  // CUSTOMIZE: Replace with your data hooks
  const { data: kpis, isLoading: kpisLoading } = useKpis(period)
  const { data: trends, isLoading: trendsLoading } = useTrends(period)
  const { data: items, isLoading: itemsLoading } = useItems(period)

  // Loading progress: fraction of key queries that have resolved
  const allLoaded = !meLoading && !kpisLoading && !trendsLoading && !itemsLoading && !!me && !!kpis
  const loadingProgress = useMemo(() => {
    if (loadingDone) return 1
    const flags = [
      !meLoading && !!me,
      !kpisLoading && !!kpis,
      !trendsLoading,
      !itemsLoading,
    ]
    const loaded = flags.filter(Boolean).length
    return loaded / flags.length
  }, [loadingDone, meLoading, me, kpisLoading, kpis, trendsLoading, itemsLoading])

  useEffect(() => {
    if (!loadingDone && allLoaded) {
      setLoadingDone(true)
      window.dispatchEvent(new CustomEvent('loading-complete'))
    }
  }, [loadingDone, allLoaded])

  return (
    <div className="min-h-screen">
      {!loadingDone && (
        <LoadingScreen
          progress={loadingProgress}
          onComplete={() => setLoadingDone(true)}
        />
      )}
      <div style={{ visibility: loadingDone ? 'visible' : 'hidden' }}>
        {/* CUSTOMIZE: Update Header title for your app */}
        <Header />
        <NavTabs />
        <FilterBar period={period} />
        <StickyKpiBar
          items={[
            // CUSTOMIZE: Replace with your summary KPI items
            { label: 'Revenue', value: kpis?.total_revenue ?? 0, format: 'currency', color: COLORS.brandPrimary },
            { label: 'Margin', value: kpis?.margin_pct ?? 0, format: 'percent', color: COLORS.brandSecondary },
            { label: 'Users', value: kpis?.active_users ?? 0, format: 'number', color: COLORS.brandAccent },
          ]}
          isLoading={kpisLoading}
        />

        <main className="px-6 py-7 space-y-5 max-w-screen-2xl mx-auto">

          {/* ── KPI Cards Row ─────────────────────────────────────────────── */}
          <motion.div
            variants={kpiGridVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch"
          >
            {/* CUSTOMIZE: Replace with your KPI definitions */}
            <KpiCard
              label="Total Revenue"
              value={kpis?.total_revenue ?? 0}
              format="currency"
              delta={kpis?.delta_revenue_pct}
              deltaLabel="vs prior period"
              isLoading={kpisLoading}
              accentColor={COLORS.brandPrimary}
            />
            <KpiCard
              label="Growth Rate"
              value={kpis?.growth_rate ?? 0}
              format="percent"
              delta={kpis?.delta_growth_pct}
              deltaLabel="vs prior period"
              isLoading={kpisLoading}
              accentColor={COLORS.brandAccent}
            />
            <KpiCard
              label="Active Users"
              value={kpis?.active_users ?? 0}
              format="number"
              delta={kpis?.delta_users_pct}
              deltaLabel="vs prior period"
              isLoading={kpisLoading}
              accentColor={COLORS.brandSecondary}
            />
            <KpiCard
              label="Conversion"
              value={kpis?.conversion_rate ?? 0}
              format="percent"
              delta={kpis?.delta_conversion_pct}
              deltaLabel="vs prior period"
              isLoading={kpisLoading}
              accentColor={COLORS.chart[3]}
            />
          </motion.div>

          {/* ── Trend Chart ───────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="card rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="section-label flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5 }}>
                  <path d="M1 11L4 7L7 9L13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1 11L4 7L7 9L13 3V11H1Z" fill="currentColor" opacity="0.1"/>
                </svg>
                {/* CUSTOMIZE: Chart title */}
                Trend Overview
              </p>
              <span className="section-label" style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                {period === 'l12m' ? '12-MONTH ROLLING' : period.toUpperCase()}
              </span>
            </div>
            {trendsLoading || !trends ? (
              <LoadingSkeleton height="h-56" />
            ) : (
              <TrendChart data={trends} height={220} />
            )}
          </motion.div>

          {/* ── Data Table ────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            {itemsLoading || !items ? (
              <LoadingSkeleton height="h-40" />
            ) : (
              <DataTable data={items} />
            )}
          </motion.div>

        </main>
      </div>
    </div>
  )
}

/** Wrapper that skips SSR to prevent hydration mismatch. */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return <>{children}</>
}

export default function DashboardPage() {
  return (
    <ClientOnly>
      <Suspense>
        <DashboardContent />
      </Suspense>
    </ClientOnly>
  )
}
