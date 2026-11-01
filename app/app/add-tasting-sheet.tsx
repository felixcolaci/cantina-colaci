'use client'

import { useState, type FormEvent } from 'react'
import { usePowerSync } from '@powersync/react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { RatingInput } from '@/components/ui/rating-input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'

// Rating is fully decoupled from opening (see OpenBottleButton and
// docs/specs/open-rate-separation.md): this only ever inserts a `tastings`
// row, never touches `skus`. Works on any entry regardless of status or who
// opened it -- cellar_entry_id has no uniqueness constraint, so multiple
// family members can each add their own tasting for the same sku.
export function AddTastingSheet({ skuId }: { skuId: string }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<string | null>(new Date().toISOString().split('T')[0])
  const [rating, setRating] = useState<number | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setDate(new Date().toISOString().split('T')[0])
    setRating(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!date || !rating) return
    const notes = (new FormData(e.currentTarget).get('notes') as string) || null

    setIsPending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nicht angemeldet')

      await db.execute(
        `INSERT INTO tastings (id, cellar_entry_id, user_id, date, rating, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), skuId, session.user.id, date, rating, notes],
      )
      reset()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        Verkostung hinzufügen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Verkostung</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Datum</Label>
            <DatePicker mode="full" name="date" value={date} onChange={v => setDate(v as string | null)} placeholder="Datum" />
          </div>
          <div className="space-y-2">
            <Label>Bewertung</Label>
            <RatingInput name="rating" value={rating} onChange={setRating} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="at-notes">Verkostungsnotizen</Label>
            <Textarea id="at-notes" name="notes" placeholder="Duft, Geschmack, Begleitung…" />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">
            Verkostung speichern
          </SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
