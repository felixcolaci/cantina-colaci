'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  lastSyncResult: { synced: number; failed: number } | null
}

export function useOfflineSync(): SyncState {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null)
  const router = useRouter()

  useEffect(() => {
    setIsOnline(navigator.onLine)
  }, [])

  const sync = useCallback(async () => {
    setIsSyncing(true)
    try {
      const { processPendingQueue } = await import('@/lib/offline/sync')
      const { processPendingScans } = await import('@/lib/offline/scan-sync')
      const result = await processPendingQueue()
      if (result.synced > 0 || result.failed > 0) {
        setLastSyncResult(result)
        if (result.synced > 0) {
          router.refresh()
          setTimeout(() => setLastSyncResult(null), 5000)
        }
      }
      const scanResult = await processPendingScans()
      if (scanResult.processed > 0 || scanResult.failed > 0) {
        window.dispatchEvent(new CustomEvent('cantina:scans-updated'))
      }
    } finally {
      setIsSyncing(false)
    }
  }, [router])

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      sync()
    }
    function handleOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sync])

  // Check for pending items on initial mount (in case app was refreshed while online)
  useEffect(() => {
    if (navigator.onLine) sync()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { isOnline, isSyncing, lastSyncResult }
}
