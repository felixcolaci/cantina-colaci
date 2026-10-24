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
import { compressImage } from '@/lib/image-compress'
import { useTripOptions } from '@/lib/powersync/queries'
import { getDiscoveryAttachmentQueue } from '@/lib/powersync/PowerSyncProvider'
import { ALLOWED_PHOTO_TYPES, buildDiscoveryPhotoPath } from '@/lib/storage/wine-photos'
import { apiMutate } from '@/lib/spa/api-client'
import type { WineType } from '@/lib/types'

const WINE_TYPES: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rot' },
  { value: 'white', label: 'Weiß' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaum' },
]

// Lokaler Insert zuerst (wie QuickAddSheet), danach -- falls ein Foto
// gewählt wurde -- ein saveFile() auf die Discovery-AttachmentQueue. Das
// legt die discovery_photos-Zeile sofort lokal an (synct normal über die
// PowerSync-CRUD-Queue) und queued die Bytes separat zum Hochladen, auch
// ganz ohne Netz -- siehe lib/powersync/attachment-queues.ts.
export function AddDiscoverySheet({ cellarId, userId }: { cellarId: string; userId: string }) {
  const db = usePowerSync()
  const { trips } = useTripOptions(cellarId)
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
      const discoveryFields = {
        cellar_id: cellarId,
        created_by: userId,
        name: trimmedName,
        producer: producer.trim() || null,
        vintage,
        type: wineType,
        location_text: locationMode === 'text' ? (locationText.trim() || null) : null,
        trip_id: locationMode === 'trip' ? (tripId || null) : null,
        date,
        rating,
        notes: notes.trim() || null,
        price: price ? parseFloat(price) : null,
      }
      await db.execute(
        `INSERT INTO discoveries
           (id, cellar_id, created_by, name, producer, vintage, type, location_text, trip_id, date, rating, notes, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, discoveryFields.cellar_id, discoveryFields.created_by, discoveryFields.name,
          discoveryFields.producer, discoveryFields.vintage, discoveryFields.type,
          discoveryFields.location_text, discoveryFields.trip_id,
          discoveryFields.date, discoveryFields.rating, discoveryFields.notes, discoveryFields.price,
        ],
      )

      if (photoFile) {
        try {
          // Best-effort head start, not a prerequisite: if this lands before
          // the queue below tries to upload bytes, it avoids a 404 (the
          // bytes upload authorizes itself by looking the discovery up
          // server-side via resolveDiscoveryFamily). Offline, this just
          // throws and is ignored -- the photo queues below regardless, and
          // a failed byte upload retries indefinitely (no errorHandler
          // configured, see attachment-queues.ts) until the discovery row
          // itself has synced through the normal CRUD queue. This mirrors
          // exactly what that queue would send, so it's a no-op 23505 once
          // it catches up.
          await apiMutate('PUT', `/discoveries/${id}`, discoveryFields)
        } catch {
          // See comment above -- queuing the photo below doesn't depend on this.
        }

        try {
          const compressed = await compressImage(photoFile)
          const ext = ALLOWED_PHOTO_TYPES[compressed.type]
          if (ext) {
            const { family_id: familyId } = await db.get<{ family_id: string }>(
              'SELECT family_id FROM cellars WHERE id = ?',
              [cellarId],
            )
            const queue = getDiscoveryAttachmentQueue()
            const photoId = await queue.generateAttachmentId()
            const path = buildDiscoveryPhotoPath(familyId, id, photoId, ext)

            await queue.saveFile({
              id: photoId,
              data: await compressed.arrayBuffer(),
              fileExtension: ext,
              mediaType: compressed.type,
              metaData: JSON.stringify({ discoveryId: id }),
              // Nur ein Foto pro Entdeckung -- eine evtl. noch wartende,
              // unsynced Zeile wird hier ersetzt, nicht ergänzt (das
              // Attachment dahinter wird dadurch verwaist und nie
              // hochgeladen, siehe AttachmentQueue.startSync()'s Diffing).
              updateHook: async tx => {
                await tx.execute('DELETE FROM discovery_photos WHERE discovery_id = ?', [id])
                await tx.execute(
                  'INSERT INTO discovery_photos (id, discovery_id, path, created_at) VALUES (?, ?, ?, ?)',
                  [photoId, id, path, new Date().toISOString()],
                )
              },
            })
          }
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
