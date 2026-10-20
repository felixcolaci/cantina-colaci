'use client'

import { useState, useTransition } from 'react'
import { inviteFamilyMember } from '@/lib/actions/family'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'

export function InviteForm() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const target = email
    setError(null)
    startTransition(async () => {
      try {
        await inviteFamilyMember(target)
        setSentTo(target)
        setEmail('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Einladung konnte nicht gesendet werden.')
      }
    })
  }

  if (sentTo) {
    return (
      <div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)', marginBottom: 'var(--space-2)' }}>
          Einladung an <strong>{sentTo}</strong> gesendet.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          style={{ fontSize: 'var(--text-sm)', color: 'var(--primary)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Weiteres Mitglied einladen
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <Input
        type="email"
        placeholder="email@beispiel.de"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      {error && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--destructive)' }}>{error}</p>
      )}
      <SubmitButton isPending={isPending} className="w-full">
        Einladung senden
      </SubmitButton>
    </form>
  )
}
