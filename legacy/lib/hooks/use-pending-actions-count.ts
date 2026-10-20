'use client'

import { useEffect, useState } from 'react'

export function usePendingActionsCount(): number {
  const [count, setCount] = useState(0)

  async function refresh() {
    const { pendingCount } = await import('@/lib/offline/db')
    setCount(await pendingCount())
  }

  useEffect(() => {
    refresh()
    window.addEventListener('cantina:actions-updated', refresh as EventListener)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('cantina:actions-updated', refresh as EventListener)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return count
}
