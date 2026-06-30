'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { updateWine } from '@/lib/actions/wine'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Wine } from '@/lib/types'

export function WineEditSheet({ wine }: { wine: Wine }) {
  const [open, setOpen] = useState(false)
  const [wineType, setWineType] = useState(wine.type)
  const { run, isPending, error } = useServerAction(updateWine)

  return (
    <div className="absolute top-3 right-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={
          <button
            className="flex items-center justify-center w-8 h-8 rounded-full"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', color: 'white' }}
            aria-label="Wein bearbeiten"
          />
        }>
          <Pencil className="h-3.5 w-3.5" />
        </SheetTrigger>
        <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Wein bearbeiten</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
            className="space-y-4 mt-4"
          >
            <input type="hidden" name="id" value={wine.id} />

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" defaultValue={wine.name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="producer">Weingut *</Label>
              <Input id="producer" name="producer" defaultValue={wine.producer} required />
            </div>

            <div className="space-y-2">
              <Label>Typ *</Label>
              <input type="hidden" name="type" value={wineType} />
                <Select
                  value={wineType}
                  onValueChange={v => setWineType(v as typeof wineType)}
                  items={[
                    { value: 'red', label: 'Rotwein' },
                    { value: 'white', label: 'Weißwein' },
                    { value: 'rosé', label: 'Rosé' },
                    { value: 'sparkling', label: 'Schaumwein' },
                  ]}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Rotwein</SelectItem>
                    <SelectItem value="white">Weißwein</SelectItem>
                    <SelectItem value="rosé">Rosé</SelectItem>
                    <SelectItem value="sparkling">Schaumwein</SelectItem>
                  </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Land</Label>
              <Input id="country" name="country" defaultValue={wine.country ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input id="region" name="region" defaultValue={wine.region ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grape_variety">Rebsorte</Label>
              <Input id="grape_variety" name="grape_variety" defaultValue={wine.grape_variety ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea id="notes" name="notes" defaultValue={wine.notes ?? ''} rows={3} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <SubmitButton isPending={isPending} className="w-full">Speichern</SubmitButton>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
