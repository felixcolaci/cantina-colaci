'use client'

import { useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { RatingInput } from '@/components/ui/rating-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'
import { useTripOptions } from '@/lib/powersync/queries'
import type { DiscoveryDetail } from '@/lib/powersync/queries'
import type { WineType } from '@/lib/types'

const WINE_TYPES: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rot' },
  { value: 'white', label: 'Weiß' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaum' },
]

// Edits an existing discovery in place, same local-first UPDATE pattern as
// WineEditSheet (app/app/wine-edit-sheet.tsx). Field set mirrors
// AddDiscoverySheet exactly -- this is that form's edit counterpart.
export function DiscoveryEditSheet({ discovery, cellarId }: { discovery: DiscoveryDetail; cellarId: string }) {
  const db = usePowerSync()
  const { trips } = useTripOptions(cellarId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(discovery.name)
  const [producer, setProducer] = useState(discovery.producer ?? '')
  const [wineType, setWineType] = useState<WineType | null>(discovery.type)
  const [vintage, setVintage] = useState<number | null>(discovery.vintage)
  const [locationMode, setLocationMode] = useState<'text' | 'trip'>(discovery.tripId ? 'trip' : 'text')
  const [locationText, setLocationText] = useState(discovery.locationText ?? '')
  const [tripId, setTripId] = useState(discovery.tripId ?? '')
  const [date, setDate] = useState<string | null>(discovery.date)
  const [rating, setRating] = useState<number | null>(discovery.rating)
  const [notes, setNotes] = useState(discovery.notes ?? '')
  const [price, setPrice] = useState(discovery.price != null ? String(discovery.price) : '')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || !date) return

    setIsPending(true)
    setError(null)
    try {
      await db.execute(
        `UPDATE discoveries
         SET name = ?, producer = ?, vintage = ?, type = ?, location_text = ?, trip_id = ?,
             date = ?, rating = ?, notes = ?, price = ?
         WHERE id = ?`,
        [
          trimmedName,
          producer.trim() || null, vintage, wineType,
          locationMode === 'text' ? (locationText.trim() || null) : null,
          locationMode === 'trip' ? (tripId || null) : null,
          date, rating, notes.trim() || null,
          price ? parseFloat(price) : null,
          discovery.id,
        ],
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
          className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', color: 'white' }}
          aria-label="Entdeckung bearbeiten"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>Entdeckung bearbeiten</SheetTitle></SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="de-name">Name *</Label>
            <Input id="de-name" required placeholder="z.B. Barolo" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="de-producer">Produzent</Label>
            <Input id="de-producer" placeholder="z.B. Gaja" value={producer} onChange={e => setProducer(e.target.value)} />
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
            <Label htmlFor="de-notes">Notizen</Label>
            <Textarea id="de-notes" placeholder="Eindruck, Essen-Pairing…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="de-price">Preis (€)</Label>
            <Input id="de-price" type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
