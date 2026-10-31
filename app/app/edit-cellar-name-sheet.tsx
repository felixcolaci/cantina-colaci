'use client'

import { useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'

// Local-first UPDATE of the cellar the caller is currently viewing,
// draining to PATCH /api/v1/cellars/[id] (see lib/powersync/connector.ts)
// -- same pattern as EditNameSheet's family_members UPDATE.
export function EditCellarNameSheet({ cellarId, currentName }: { cellarId: string; currentName: string }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim().slice(0, 60)
    if (!trimmed) {
      setError('Bitte einen Namen angeben')
      return
    }
    setIsPending(true)
    setError(null)
    try {
      await db.execute(`UPDATE cellars SET name = ? WHERE id = ?`, [trimmed, cellarId])
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={next => { setOpen(next); if (next) setName(currentName) }}>
      <SheetTrigger render={
        <button
          aria-label="Kellername bearbeiten"
          type="button"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted-foreground)',
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-sm)',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <Pencil size={16} />
        </button>
      } />
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Keller umbenennen</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="ecn-name">Name</Label>
            <Input
              id="ecn-name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              required
            />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
