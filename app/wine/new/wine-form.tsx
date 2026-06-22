'use client'

import { useState } from 'react'
import { addWine } from '@/lib/actions/wine'
import { compressImage } from '@/lib/image-compress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Trip } from '@/lib/types'

interface WineFormProps {
  trips: Pick<Trip, 'id' | 'name'>[]
}

export function WineForm({ trips }: WineFormProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [compressedFile, setCompressedFile] = useState<File | null>(null)

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setCompressedFile(compressed)
    setPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit(formData: FormData) {
    if (compressedFile) formData.set('photo', compressedFile)
    await addWine(formData)
  }

  return (
    <form action={handleSubmit} className="space-y-4 pb-8">
      <div className="space-y-2">
        <Label>Foto der Flasche</Label>
        {preview && (
          <img src={preview} alt="Vorschau" className="w-24 h-32 object-cover rounded border" />
        )}
        <Input type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="producer">Weingut / Hersteller *</Label>
        <Input id="producer" name="producer" required />
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
        <Label htmlFor="region">Region</Label>
        <Input id="region" name="region" placeholder="z.B. Toskana" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Land</Label>
        <Input id="country" name="country" placeholder="z.B. Italien" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="grape_variety">Rebsorte</Label>
        <Input id="grape_variety" name="grape_variety" placeholder="z.B. Sangiovese" />
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
        <Label htmlFor="purchase_location">Kaufort</Label>
        <Input id="purchase_location" name="purchase_location" placeholder="z.B. Montalcino" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shelf_location">Position im Keller</Label>
        <Input id="shelf_location" name="shelf_location" placeholder="z.B. Regal B / Reihe 3" />
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

      <Button type="submit" className="w-full">Wein hinzufügen</Button>
    </form>
  )
}
