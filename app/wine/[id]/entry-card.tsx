'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { updateEntry } from '@/lib/actions/entries'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type StorageLocation = { id: string; name: string }

export type EntryWithLocation = {
  id: string
  wine_id: string
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  purchase_location: string | null
  shelf_location: string | null
  storage_location_id: string | null
  storage_locations: { name: string; type: string } | null
}

export function EntryCard({
  entry,
  storageLocations,
}: {
  entry: EntryWithLocation
  storageLocations: StorageLocation[]
}) {
  const [open, setOpen] = useState(false)
  const [locId, setLocId] = useState(entry.storage_location_id ?? '')
  const { run, isPending, error } = useServerAction(updateEntry)

  const locName = entry.storage_locations?.name

  return (
    <div
      className="relative rounded-xl p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-full"
        style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
        aria-label="Eintrag bearbeiten"
      >
        <Pencil className="h-3 w-3" />
      </button>

      <div className="flex items-baseline gap-1.5 mb-1">
        <span
          className="nums leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-4xl)',
            fontWeight: 700,
            color: 'var(--primary)',
          }}
        >
          {entry.quantity}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
          {entry.quantity === 1 ? 'Flasche' : 'Flaschen'}
        </span>
      </div>

      {(locName || entry.shelf_location) && (
        <p className="text-sm" style={{ color: 'var(--ink-700)' }}>
          {[locName, entry.shelf_location].filter(Boolean).join(' · ')}
        </p>
      )}

      {(entry.purchase_date || entry.purchase_price != null || entry.purchase_location) && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
          {[
            entry.purchase_date
              ? new Date(entry.purchase_date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
              : null,
            entry.purchase_price != null
              ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(entry.purchase_price)
              : null,
            entry.purchase_location,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Eintrag bearbeiten</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
            className="space-y-4 mt-4"
          >
            <input type="hidden" name="id" value={entry.id} />
            <input type="hidden" name="wine_id" value={entry.wine_id} />

            <div className="space-y-2">
              <Label htmlFor="quantity">Anzahl Flaschen *</Label>
              <Input id="quantity" name="quantity" type="number" min="0" max="999"
                defaultValue={entry.quantity} required />
            </div>

            {storageLocations.length > 0 && (
              <div className="space-y-2">
                <Label>Lagerort</Label>
                <input type="hidden" name="storage_location_id" value={locId} />
                <Select value={locId} onValueChange={v => setLocId(v ?? '')}>
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

            <div className="space-y-2">
              <Label htmlFor="shelf_location">Reihe / Fach</Label>
              <Input id="shelf_location" name="shelf_location"
                defaultValue={entry.shelf_location ?? ''} placeholder="z.B. Reihe 3" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Preis (€)</Label>
                <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0"
                  defaultValue={entry.purchase_price ?? ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Kaufdatum</Label>
                <Input id="purchase_date" name="purchase_date" type="date"
                  defaultValue={entry.purchase_date ?? ''} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_location">Kaufort</Label>
              <Input id="purchase_location" name="purchase_location"
                defaultValue={entry.purchase_location ?? ''} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <SubmitButton isPending={isPending} className="w-full">Speichern</SubmitButton>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
