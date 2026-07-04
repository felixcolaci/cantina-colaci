'use client'

import { useEffect, useState } from 'react'

export function usePendingScansCount(): number {
  const [count, setCount] = useState(0)

  async function refresh() {
    const { readyScanCount } = await import('@/lib/offline/db')
    setCount(await readyScanCount())
  }

  useEffect(() => {
    refresh()
    window.addEventListener('cantina:scans-updated', refresh as EventListener)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('cantina:scans-updated', refresh as EventListener)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return count
}
