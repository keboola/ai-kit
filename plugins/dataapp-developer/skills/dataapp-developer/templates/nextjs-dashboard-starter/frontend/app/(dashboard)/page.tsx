'use client'

/*
 * DASHBOARD PAGE
 *
 * Header + NavTabs are in the shared layout — don't import them here.
 * DataStatusBadge ("N tables loaded") lives in the Header — see design-components.md.
 * Replace placeholder cards with real components as you build.
 */
export default function DashboardPage() {
  return (
    <>
      {/* Bento grid — CUSTOMIZE: Replace placeholders with real components */}
      <div className="bento-grid">
        <div className="span-3 placeholder-card">KPI 1</div>
        <div className="span-3 placeholder-card">KPI 2</div>
        <div className="span-3 placeholder-card">KPI 3</div>
        <div className="span-3 placeholder-card">KPI 4</div>

        <div className="span-7 placeholder-card min-h-[280px]">Chart Area</div>
        <div className="span-5 placeholder-card min-h-[280px]">Table Area</div>
      </div>
    </>
  )
}
