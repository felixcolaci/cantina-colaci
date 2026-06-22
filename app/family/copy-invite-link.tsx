'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function CopyInviteLink({ familyId }: { familyId: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(`${window.location.origin}/join?family=${familyId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" className="w-full" onClick={copy}>
      {copied ? '✓ Link copiato!' : 'Copia link di invito'}
    </Button>
  )
}
