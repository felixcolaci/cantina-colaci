'use client'

import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'

// Local-first insert, same pattern as QuickAddSheet/AddSkuSheet: the
// connector drains this as UpdateType.PUT to PUT /api/v1/trips/[id].
export function NewTripSheet({ cellarId }: { cellarId: string }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [dateStart, setDateStart] = useState<string | null>(new Date().toISOString().split('T')[0])
  const [dateEnd, setDateEnd] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setLocation('')
    setDateStart(new Date().toISOString().split('T')[0])
    setDateEnd(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    setIsPending(true)
    setError(null)
    try {
      await db.execute(
        `INSERT INTO trips (id, cellar_id, name, location, date_start, date_end) VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), cellarId, trimmedName, location.trim() || null, dateStart, dateEnd],
      )
      reset()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />Hinzufügen
        </Button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Neue Reise</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="nt-name">Name *</Label>
            <Input
              id="nt-name"
              placeholder="Toskana Sommer 2026"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nt-location">Ort</Label>
            <Input
              id="nt-location"
              placeholder="Toskana, Italien"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Beginn</Label>
              <DatePicker mode="full" name="date_start" value={dateStart} onChange={v => setDateStart(v as string | null)} placeholder="Beginn" />
            </div>
            <div className="space-y-2">
              <Label>Ende</Label>
              <DatePicker mode="full" name="date_end" value={dateEnd} onChange={v => setDateEnd(v as string | null)} placeholder="Ende" />
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Reise anlegen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
