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
        <Label>Foto della bottiglia</Label>
        {preview && (
          <img src={preview} alt="Anteprima" className="w-24 h-32 object-cover rounded border" />
        )}
        <Input type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="producer">Produttore *</Label>
        <Input id="producer" name="producer" required />
      </div>

      <div className="space-y-2">
        <Label>Tipo *</Label>
        <Select name="type" required>
          <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="red">Rosso</SelectItem>
            <SelectItem value="white">Bianco</SelectItem>
            <SelectItem value="rosé">Rosé</SelectItem>
            <SelectItem value="sparkling">Spumante</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="vintage">Annata</Label>
          <Input id="vintage" name="vintage" type="number" min="1900" max="2099" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Bottiglie</Label>
          <Input id="quantity" name="quantity" type="number" min="1" defaultValue="1" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="region">Regione</Label>
        <Input id="region" name="region" placeholder="es. Toscana" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Paese</Label>
        <Input id="country" name="country" placeholder="es. Italia" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="grape_variety">Vitigno</Label>
        <Input id="grape_variety" name="grape_variety" placeholder="es. Sangiovese" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="purchase_price">Prezzo (€)</Label>
          <Input id="purchase_price" name="purchase_price" type="number" step="0.01" min="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase_date">Data acquisto</Label>
          <Input id="purchase_date" name="purchase_date" type="date" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="purchase_location">Luogo acquisto</Label>
        <Input id="purchase_location" name="purchase_location" placeholder="es. Montalcino" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shelf_location">Posizione in cantina</Label>
        <Input id="shelf_location" name="shelf_location" placeholder="es. Scaffale B / Fila 3" />
      </div>

      {trips.length > 0 && (
        <div className="space-y-2">
          <Label>Viaggio</Label>
          <Select name="trip_id">
            <SelectTrigger><SelectValue placeholder="Seleziona viaggio (opzionale)" /></SelectTrigger>
            <SelectContent>
              {trips.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" name="notes" placeholder="Note generali sul vino…" />
      </div>

      <Button type="submit" className="w-full">Aggiungi vino</Button>
    </form>
  )
}
