'use client'

import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { useStorageLocations } from '@/lib/powersync/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'

// "Nachkaufen": adds another posten/sku to an already-existing wine, with
// its own vintage/purchase details -- distinct from QuickAddSheet, which
// creates both a wine and its first sku together. Local-first via PowerSync,
// same pattern as QuickAddSheet; the connector drains the insert as
// UpdateType.PUT to the now-extended PUT /api/v1/skus/[id] route.
export function AddSkuSheet({ wineId, cellarId }: { wineId: string; cellarId: string }) {
  const db = usePowerSync()
  const { storageLocations } = useStorageLocations(cellarId)
  const [open, setOpen] = useState(false)
  const [vintage, setVintage] = useState<number | null>(null)
  const [storageLocationId, setStorageLocationId] = useState<string | null>(null)
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null)
  const [purchaseLocation, setPurchaseLocation] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setVintage(null)
    setStorageLocationId(null)
    setPurchaseDate(null)
    setPurchaseLocation('')
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const quantity = parseInt(formData.get('quantity') as string, 10)
    const purchasePriceRaw = formData.get('purchase_price') as string
    const purchasePrice = purchasePriceRaw ? parseFloat(purchasePriceRaw) : null

    setIsPending(true)
    setError(null)
    try {
      const skuId = crypto.randomUUID()
      await db.execute(
        `INSERT INTO skus (id, wine_id, vintage, quantity, storage_location_id, status, purchase_price, purchase_date, purchase_location, shelf_location, trip_id, photo_path)
         VALUES (?, ?, ?, ?, ?, 'in_stock', ?, ?, ?, NULL, NULL, NULL)`,
        [skuId, wineId, vintage, quantity, storageLocationId, purchasePrice, purchaseDate, purchaseLocation.trim() || null],
      )
      reset()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hinzufügen fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

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

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="as-quantity">Anzahl Flaschen *</Label>
              <Input id="as-quantity" name="quantity" type="number" min="1" max="999" defaultValue={1} required />
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
              <Label htmlFor="as-purchase-price">Preis (€)</Label>
              <Input id="as-purchase-price" name="purchase_price" type="number" step="0.01" min="0" />
            </div>
            <div className="space-y-2">
              <Label>Kaufdatum</Label>
              <DatePicker mode="full" name="purchase_date" value={purchaseDate} onChange={v => setPurchaseDate(v as string | null)} placeholder="Datum" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="as-purchase-location">Kaufort</Label>
            <Input
              id="as-purchase-location"
              value={purchaseLocation}
              onChange={e => setPurchaseLocation(e.target.value)}
            />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Hinzufügen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
