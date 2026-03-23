'use client'

import dynamic from 'next/dynamic'
import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query'

const EchartsInit = dynamic(() => import('@/components/layout/EchartsInit'), { ssr: false })

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,  // 5 minutes
        gcTime: 60 * 60 * 1000,    // 1 hour
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (isServer) {
    return makeQueryClient()
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <EchartsInit />
      {children}
    </QueryClientProvider>
  )
}
