'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PowerSyncProvider } from '@/lib/powersync/PowerSyncProvider'

export default function SpaLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <PowerSyncProvider>{children}</PowerSyncProvider>
    </QueryClientProvider>
  )
}
