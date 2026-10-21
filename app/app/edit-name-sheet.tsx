'use client'

import { useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'

// Local-first UPDATE of the caller's own family_members row, draining to
// PATCH /api/v1/family_members/[id] (see lib/powersync/connector.ts).
export function EditNameSheet({ memberId, currentName }: { memberId: string; currentName: string }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setError(null)
    try {
      await db.execute(
        `UPDATE family_members SET display_name = ? WHERE id = ?`,
        [name.trim().slice(0, 40) || null, memberId],
      )
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <button
          aria-label="Namen bearbeiten"
          type="button"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted-foreground)',
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Pencil size={14} />
        </button>
      } />
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Namen ändern</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="en-display-name">Anzeigename</Label>
            <Input
              id="en-display-name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
