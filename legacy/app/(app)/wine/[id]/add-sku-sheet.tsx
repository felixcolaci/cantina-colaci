'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { addSku } from '@/lib/actions/skus'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type StorageLocation = { id: string; name: string }

export function AddSkuSheet({
  wineId,
  storageLocations,
}: {
  wineId: string
  storageLocations: StorageLocation[]
}) {
  const [open, setOpen] = useState(false)
  const [vintage, setVintage] = useState<number | null>(null)
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null)
  const [locId, setLocId] = useState('')
  const { run, isPending, error } = useServerAction(addSku)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1" />Nachkaufen
        </Button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nachkaufen</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <input type="hidden" name="wine_id" value={wineId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Anzahl Flaschen *</Label>
              <Input id="quantity" name="quantity" type="number" min="1" max="999"
                defaultValue={1} required />
            </div>
            <div className="space-y-2">
              <Label>Jahrgang</Label>
              <DatePicker
                mode="year"
                name="vintage"
                value={vintage}
                onChange={v => setVintage(v as number | null)}
                placeholder="Jahr"
              />
            </div>
          </div>

          {storageLocations.length > 0 && (
            <div className="space-y-2">
              <Label>Lagerort</Label>
              <input type="hidden" name="storage_location_id" value={locId} />
              <Select
                value={locId}
                onValueChange={v => setLocId(v ?? '')}
                items={[
                  { value: '', label: 'Kein Lagerort' },
                  ...storageLocations.map(loc => ({ value: loc.id, label: loc.name })),
                ]}
              >
                <SelectTrigger><SelectValue placeholder="Kein Lagerort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kein Lagerort</SelectItem>
                  {storageLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="purchase_price">Preis (€)</Label>
              <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" />
            </div>
            <div className="space-y-2">
              <Label>Kaufdatum</Label>
              <DatePicker
                mode="full"
                name="purchase_date"
                value={purchaseDate}
                onChange={v => setPurchaseDate(v as string | null)}
                placeholder="Datum"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_location">Kaufort</Label>
            <Input id="purchase_location" name="purchase_location" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Hinzufügen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
