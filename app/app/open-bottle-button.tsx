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

// Reunites the two halves of the legacy openBottle action
// (legacy/lib/actions/tasting.ts) in one local-first writeTransaction:
// decrementing the sku's quantity (added in the SKU migration) and
// inserting the tasting that prompted opening it in the first place. Both
// rows land in the same local transaction, so the connector drains them as
// two separate uploads (UPDATE skus, INSERT tastings) but they commit
// locally atomically.
export function OpenBottleButton({ skuId, quantity }: { skuId: string; quantity: number }) {
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

      const newQuantity = quantity - 1
      await db.writeTransaction(async tx => {
        await tx.execute(
          `UPDATE skus SET quantity = ?, status = ? WHERE id = ?`,
          [newQuantity, newQuantity <= 0 ? 'consumed' : 'in_stock', skuId],
        )
        await tx.execute(
          `INSERT INTO tastings (id, cellar_entry_id, user_id, date, rating, notes) VALUES (?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), skuId, session.user.id, date, rating, notes],
        )
      })
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
        Flasche öffnen
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
            <Label htmlFor="ob-notes">Verkostungsnotizen</Label>
            <Textarea id="ob-notes" name="notes" placeholder="Duft, Geschmack, Begleitung…" />
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
