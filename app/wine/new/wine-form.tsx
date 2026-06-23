'use client'

import { useState } from 'react'
import { addWine } from '@/lib/actions/wine'
import { compressImage } from '@/lib/image-compress'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { WINE_COUNTRIES, WINE_REGIONS, GRAPE_VARIETIES } from '@/lib/wine-data'
import type { Trip, WineHints, StorageLocation } from '@/lib/types'

interface WineFormProps {
  trips: Pick<Trip, 'id' | 'name'>[]
  hints: WineHints
  storageLocations: Pick<StorageLocation, 'id' | 'name' | 'type'>[]
}

export function WineForm({ trips, hints, storageLocations }: WineFormProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [compressedFile, setCompressedFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [producer, setProducer] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [grapeVariety, setGrapeVariety] = useState('')
  const [purchaseLocation, setPurchaseLocation] = useState('')

  const { run, isPending, error } = useServerAction(async (formData: FormData) => {
    if (compressedFile) formData.set('photo', compressedFile)
    await addWine(formData)
  })

  const countryOptions = [...new Set([...WINE_COUNTRIES, ...hints.ownCountries])]
  const regionOptions = [...new Set([
    ...(WINE_REGIONS[country] ?? []),
    ...(hints.ownRegionsByCountry[country] ?? []),
  ])]

  function handleCountryChange(value: string) {
    setCountry(value)
    setRegion('')
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setCompressedFile(compressed)
    setPreview(URL.createObjectURL(compressed))
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
      className="space-y-4 pb-8"
    >
      <div className="space-y-2">
        <Label>Foto der Flasche</Label>
        {preview && (
          <img src={preview} alt="Vorschau" className="w-24 h-32 object-cover rounded border" />
        )}
        <Input type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
      </div>

      <div className="space-y-2">
        <Label>Name *</Label>
        <Combobox
          name="name"
          value={name}
          onChange={setName}
          options={hints.names}
          placeholder="z.B. Barolo"
        />
      </div>

      <div className="space-y-2">
        <Label>Weingut / Hersteller *</Label>
        <Combobox
          name="producer"
          value={producer}
          onChange={setProducer}
          options={hints.producers}
          placeholder="z.B. Antinori"
        />
      </div>

      <div className="space-y-2">
        <Label>Weintyp *</Label>
        <Select name="type" required>
          <SelectTrigger><SelectValue placeholder="Typ auswählen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="red">Rotwein</SelectItem>
            <SelectItem value="white">Weißwein</SelectItem>
            <SelectItem value="rosé">Rosé</SelectItem>
            <SelectItem value="sparkling">Schaumwein</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="vintage">Jahrgang</Label>
          <Input id="vintage" name="vintage" type="number" min="1900" max="2099" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Flaschen</Label>
          <Input id="quantity" name="quantity" type="number" min="1" defaultValue="1" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Land</Label>
        <Combobox
          name="country"
          value={country}
          onChange={handleCountryChange}
          options={countryOptions}
          placeholder="z.B. Italien"
        />
      </div>

      <div className="space-y-2">
        <Label>Region</Label>
        <Combobox
          name="region"
          value={region}
          onChange={setRegion}
          options={regionOptions}
          placeholder="z.B. Toskana"
        />
      </div>

      <div className="space-y-2">
        <Label>Rebsorte</Label>
        <Combobox
          name="grape_variety"
          value={grapeVariety}
          onChange={setGrapeVariety}
          options={[...new Set([...GRAPE_VARIETIES, ...hints.grapeVarieties])]}
          placeholder="z.B. Sangiovese"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="purchase_price">Preis (€)</Label>
          <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase_date">Kaufdatum</Label>
          <Input id="purchase_date" name="purchase_date" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Kaufort</Label>
        <Combobox
          name="purchase_location"
          value={purchaseLocation}
          onChange={setPurchaseLocation}
          options={hints.purchaseLocations}
          placeholder="z.B. Montalcino"
        />
      </div>

      {storageLocations.length > 0 && (
        <div className="space-y-2">
          <Label>Lagerort</Label>
          <Select name="storage_location_id">
            <SelectTrigger><SelectValue placeholder="Lagerort auswählen (optional)" /></SelectTrigger>
            <SelectContent>
              {storageLocations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="shelf_location">Genaue Position (optional)</Label>
        <Input id="shelf_location" name="shelf_location" placeholder="z.B. Reihe 2, Fach B" />
      </div>

      {trips.length > 0 && (
        <div className="space-y-2">
          <Label>Reise</Label>
          <Select name="trip_id">
            <SelectTrigger><SelectValue placeholder="Reise auswählen (optional)" /></SelectTrigger>
            <SelectContent>
              {trips.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea id="notes" name="notes" placeholder="Allgemeine Notizen zum Wein…" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <SubmitButton isPending={isPending} className="w-full">Wein hinzufügen</SubmitButton>
    </form>
  )
}
