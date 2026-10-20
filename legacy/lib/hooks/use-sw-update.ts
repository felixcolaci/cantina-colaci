'use client'

import { useEffect, useState, useCallback } from 'react'

export function useSwUpdate() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const handleRegistration = (reg: ServiceWorkerRegistration) => {
      // Already waiting on mount (e.g. user had app open when deploy happened)
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingSW(reg.waiting)
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingSW(installing)
          }
        })
      })
    }

    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) handleRegistration(reg)
    })

    // After skipWaiting the controller changes — reload to activate new assets
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })
  }, [])

  const applyUpdate = useCallback(() => {
    if (!waitingSW) return
    waitingSW.postMessage({ type: 'SKIP_WAITING' })
  }, [waitingSW])

  return { updateReady: !!waitingSW, applyUpdate }
}
