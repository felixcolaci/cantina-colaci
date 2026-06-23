'use client'

import { useState } from 'react'
import { openBottle } from '@/lib/actions/tasting'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function OpenBottleButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false)
  const { run, isPending, error } = useServerAction(openBottle)
  const today = new Date().toISOString().split('T')[0]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="w-full" />}>
        Flasche öffnen
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Verkostung</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <input type="hidden" name="cellar_entry_id" value={entryId} />
          <div className="space-y-2">
            <Label htmlFor="date">Datum</Label>
            <Input id="date" name="date" type="date" defaultValue={today} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating">Bewertung (1–10)</Label>
            <Input id="rating" name="rating" type="number" min="1" max="10" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Verkostungsnotizen</Label>
            <Textarea id="notes" name="notes" placeholder="Duft, Geschmack, Begleitung…" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Verkostung speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
