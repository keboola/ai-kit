import Header from '@/components/layout/Header'
import NavTabs from '@/components/layout/NavTabs'

/*
 * SHARED DASHBOARD LAYOUT
 *
 * Header + NavTabs render ONCE here — every page inside (dashboard)/
 * inherits them automatically. No need to import in individual pages.
 *
 * TO ADD SHARED UI (sidebar, footer, filter bar):
 *   Add it here. It persists across all pages in this route group.
 *
 * Next.js route groups: (dashboard) is a logical group — the parentheses
 * mean it does NOT appear in the URL. "/" maps to (dashboard)/page.tsx.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <NavTabs />
      <main className="container-page py-6">
        {children}
      </main>
    </div>
  )
}
