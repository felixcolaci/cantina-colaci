'use client'

import { useState } from 'react'
import { createFamilyInvite } from '@/lib/actions/family'
import { Button } from '@/components/ui/button'

export function CopyInviteLink() {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copy() {
    setError(null)
    setLoading(true)
    try {
      const { token } = await createFamilyInvite()
      await navigator.clipboard.writeText(`${window.location.origin}/join?token=${token}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Einladungslink konnte nicht erstellt werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button variant="outline" className="w-full" onClick={copy} disabled={loading}>
        {copied ? '✓ Link kopiert!' : loading ? 'Erstelle Link…' : 'Einladungslink kopieren'}
      </Button>
      {error && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--destructive)', marginTop: 'var(--space-2)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
