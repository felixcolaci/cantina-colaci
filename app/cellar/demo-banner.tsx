'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(sessionStorage.getItem('demo-banner-dismissed') === 'true')
  }, [])

  function dismiss() {
    sessionStorage.setItem('demo-banner-dismissed', 'true')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 mb-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">Demo-Modus</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Erkunde deine Cantina mit Beispielweinen. Wenn du bereit bist, starte mit deinen echten Weinen.
        </p>
        <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-amber-300" render={<Link href="/family#start" />}>
          Eigene Cantina starten
        </Button>
      </div>
      <button onClick={dismiss} className="text-amber-400 hover:text-amber-600 shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
