'use client'

import { useState } from 'react'
import { openBottle } from '@/lib/actions/tasting'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function OpenBottleButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="w-full" />}>
        🍾 Apri una bottiglia
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Degustazione</SheetTitle>
        </SheetHeader>
        <form action={openBottle} className="space-y-4 mt-4">
          <input type="hidden" name="cellar_entry_id" value={entryId} />
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input id="date" name="date" type="date" defaultValue={today} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rating">Voto (1–10)</Label>
            <Input id="rating" name="rating" type="number" min="1" max="10" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Note di degustazione</Label>
            <Textarea id="notes" name="notes" placeholder="Profumo, sapore, abbinamento…" />
          </div>
          <Button type="submit" className="w-full">Salva degustazione</Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
