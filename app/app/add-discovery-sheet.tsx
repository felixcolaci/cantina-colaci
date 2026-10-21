'use client'

import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { RatingInput } from '@/components/ui/rating-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'
import { apiUpload } from '@/lib/spa/api-client'
import { compressImage } from '@/lib/image-compress'
import { useTrips } from '@/lib/powersync/queries'
import type { WineType } from '@/lib/types'

const WINE_TYPES: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rot' },
  { value: 'white', label: 'Weiß' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaum' },
]

// Lokaler Insert zuerst (wie QuickAddSheet), danach -- falls ein Foto
// gewählt wurde -- ein direkter Upload-Versuch. Dieser kann fehlschlagen,
// solange die Zeile noch nicht beim Server gelandet ist (der Connector
// drained den Insert asynchron); der Fehler wird dann verschluckt, der
// Eintrag bleibt ohne Foto -- gleiches Degradationsverhalten wie
// WinePhotoGallery bei einem Upload ohne Netz.
export function AddDiscoverySheet({ cellarId, userId }: { cellarId: string; userId: string }) {
  const db = usePowerSync()
  const { trips } = useTrips(cellarId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [producer, setProducer] = useState('')
  const [wineType, setWineType] = useState<WineType | null>(null)
  const [vintage, setVintage] = useState<number | null>(null)
  const [locationMode, setLocationMode] = useState<'text' | 'trip'>('text')
  const [locationText, setLocationText] = useState('')
  const [tripId, setTripId] = useState('')
  const [date, setDate] = useState<string | null>(new Date().toISOString().split('T')[0])
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [price, setPrice] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName(''); setProducer(''); setWineType(null); setVintage(null)
    setLocationMode('text'); setLocationText(''); setTripId('')
    setDate(new Date().toISOString().split('T')[0])
    setRating(null); setNotes(''); setPrice(''); setPhotoFile(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || !date) return

    setIsPending(true)
    setError(null)
    try {
      const id = crypto.randomUUID()
      await db.execute(
        `INSERT INTO discoveries
           (id, cellar_id, created_by, name, producer, vintage, type, location_text, trip_id, date, rating, notes, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, cellarId, userId, trimmedName,
          producer.trim() || null, vintage, wineType,
          locationMode === 'text' ? (locationText.trim() || null) : null,
          locationMode === 'trip' ? (tripId || null) : null,
          date, rating, notes.trim() || null,
          price ? parseFloat(price) : null,
        ],
      )

      if (photoFile) {
        try {
          const compressed = await compressImage(photoFile)
          const formData = new FormData()
          formData.append('photo', compressed)
          await apiUpload(`/discoveries/${id}/photo`, formData)
        } catch {
          // Siehe Kommentar oben am Export -- Eintrag bleibt ohne Foto.
        }
      }

      reset()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Entdeckung</Button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>Entdeckung hinzufügen</SheetTitle></SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="ds-name">Name *</Label>
            <Input id="ds-name" required placeholder="z.B. Barolo" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ds-producer">Produzent</Label>
            <Input id="ds-producer" placeholder="z.B. Gaja" value={producer} onChange={e => setProducer(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jahrgang</Label>
              <DatePicker mode="year" name="vintage" value={vintage} onChange={v => setVintage(v as number | null)} placeholder="Jahr" />
            </div>
            <div className="space-y-2">
              <Label>Datum</Label>
              <DatePicker mode="full" name="date" value={date} onChange={v => setDate(v as string | null)} placeholder="Datum" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Typ</Label>
            <div className="flex gap-2">
              {WINE_TYPES.map(t => (
                <button
                  key={t.value} type="button" onClick={() => setWineType(wineType === t.value ? null : t.value)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)', fontWeight: 500, border: '1px solid', cursor: 'pointer',
                    background: wineType === t.value ? 'var(--primary)' : 'var(--background)',
                    color: wineType === t.value ? 'var(--primary-foreground)' : 'var(--foreground)',
                    borderColor: wineType === t.value ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fundort</Label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setLocationMode('text')}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', border: '1px solid',
                  background: locationMode === 'text' ? 'var(--primary)' : 'var(--background)',
                  color: locationMode === 'text' ? 'var(--primary-foreground)' : 'var(--foreground)',
                  borderColor: locationMode === 'text' ? 'var(--primary)' : 'var(--border)',
                }}
              >
                Freitext
              </button>
              <button type="button" onClick={() => setLocationMode('trip')} disabled={trips.length === 0}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', border: '1px solid',
                  background: locationMode === 'trip' ? 'var(--primary)' : 'var(--background)',
                  color: locationMode === 'trip' ? 'var(--primary-foreground)' : 'var(--foreground)',
                  borderColor: locationMode === 'trip' ? 'var(--primary)' : 'var(--border)',
                  opacity: trips.length === 0 ? 0.5 : 1,
                }}
              >
                Reise
              </button>
            </div>
            {locationMode === 'text' ? (
              <Input placeholder="z.B. Osteria da Mario" value={locationText} onChange={e => setLocationText(e.target.value)} />
            ) : (
              <Select
                value={tripId}
                onValueChange={v => setTripId(v ?? '')}
                items={trips.map(t => ({ value: t.id, label: t.name }))}
              >
                <SelectTrigger><SelectValue placeholder="Reise wählen" /></SelectTrigger>
                <SelectContent>
                  {trips.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Bewertung</Label>
            <RatingInput name="rating" value={rating} onChange={setRating} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ds-notes">Notizen</Label>
            <Textarea id="ds-notes" placeholder="Eindruck, Essen-Pairing…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ds-price">Preis (€)</Label>
            <Input id="ds-price" type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ds-photo">Foto (Etikett)</Label>
            <Input id="ds-photo" type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Entdeckung speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
