'use client'

import { useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { useStorageLocations } from '@/lib/powersync/queries'
import type { WineDetailEntry } from '@/lib/powersync/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'

// Edits an existing sku (bottle batch) row in place -- the counterpart to
// AddSkuSheet for posten that already exist. Covers the fields AddSkuSheet
// collects on creation (vintage, quantity, storage, price, purchase date/
// location), since none of them are editable anywhere else once a posten
// has been added.
export function SkuEditSheet({ entry, cellarId }: { entry: WineDetailEntry; cellarId: string }) {
  const db = usePowerSync()
  const { storageLocations } = useStorageLocations(cellarId)
  const [open, setOpen] = useState(false)
  const [vintage, setVintage] = useState<number | null>(entry.vintage)
  const [storageLocationId, setStorageLocationId] = useState<string | null>(entry.storageLocationId)
  const [purchaseDate, setPurchaseDate] = useState<string | null>(entry.purchaseDate)
  const [purchaseLocation, setPurchaseLocation] = useState(entry.purchaseLocation ?? '')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const quantity = parseInt(formData.get('quantity') as string, 10)
    const purchasePriceRaw = formData.get('purchase_price') as string
    const purchasePrice = purchasePriceRaw ? parseFloat(purchasePriceRaw) : null

    setIsPending(true)
    setError(null)
    try {
      await db.execute(
        `UPDATE skus
         SET vintage = ?, quantity = ?, storage_location_id = ?, purchase_price = ?, purchase_date = ?, purchase_location = ?
         WHERE id = ?`,
        [vintage, quantity, storageLocationId, purchasePrice, purchaseDate, purchaseLocation.trim() || null, entry.id],
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
          className="inline-flex items-center justify-center w-7 h-7 rounded-full"
          style={{ color: 'var(--muted-foreground)' }}
          aria-label="Posten bearbeiten"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Posten bearbeiten</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="se-quantity">Anzahl Flaschen *</Label>
              <Input id="se-quantity" name="quantity" type="number" min="1" max="999" defaultValue={entry.quantity} required />
            </div>
            <div className="space-y-2">
              <Label>Jahrgang</Label>
              <DatePicker mode="year" name="vintage" value={vintage} onChange={v => setVintage(v as number | null)} placeholder="Jahr" />
            </div>
          </div>

          {storageLocations.length > 0 && (
            <div className="space-y-2">
              <Label>Lagerort</Label>
              <Select
                value={storageLocationId ?? ''}
                onValueChange={v => setStorageLocationId(v || null)}
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
              <Label htmlFor="se-purchase-price">Preis (€)</Label>
              <Input id="se-purchase-price" name="purchase_price" type="number" step="0.01" min="0" defaultValue={entry.purchasePrice ?? undefined} />
            </div>
            <div className="space-y-2">
              <Label>Kaufdatum</Label>
              <DatePicker mode="full" name="purchase_date" value={purchaseDate} onChange={v => setPurchaseDate(v as string | null)} placeholder="Datum" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="se-purchase-location">Kaufort</Label>
            <Input
              id="se-purchase-location"
              value={purchaseLocation}
              onChange={e => setPurchaseLocation(e.target.value)}
            />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
