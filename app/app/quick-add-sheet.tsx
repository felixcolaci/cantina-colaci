'use client'

import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { usePowerSync } from '@powersync/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SubmitButton } from '@/components/ui/submit-button'
import { compressImage } from '@/lib/image-compress'
import { getWineAttachmentQueue } from '@/lib/powersync/PowerSyncProvider'
import { ALLOWED_PHOTO_TYPES, buildWinePhotoPath } from '@/lib/storage/wine-photos'
import { apiMutate } from '@/lib/spa/api-client'
import type { WineType } from '@/lib/types'

const WINE_TYPES: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rot' },
  { value: 'white', label: 'Weiß' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaum' },
]

// Simplest possible write path: two local inserts (no scan-label, hints, or
// storage-location picker -- CellarScreen doesn't group by location yet
// either). PowerSync's own triggers queue both rows for upload the moment
// the transaction commits locally, so the UI never calls the network
// directly for them -- lib/powersync/connector.ts drains the queue into the
// PUT /api/v1/wines/[id] and /api/v1/skus/[id] routes, online or not. The
// optional photo is the one exception, same as AddDiscoverySheet
// (app/app/add-discovery-sheet.tsx): it needs a direct, awaited network step.
export function QuickAddSheet({ cellarId }: { cellarId: string }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [producer, setProducer] = useState('')
  const [wineType, setWineType] = useState<WineType>('red')
  const [vintage, setVintage] = useState<number | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setProducer('')
    setWineType('red')
    setVintage(null)
    setPhotoFile(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    const quantity = parseInt(new FormData(e.currentTarget).get('quantity') as string, 10)

    setIsPending(true)
    setError(null)
    try {
      const wineId = crypto.randomUUID()
      const skuId = crypto.randomUUID()
      const trimmedProducer = producer.trim()
      await db.writeTransaction(async tx => {
        await tx.execute(
          `INSERT INTO wines (id, cellar_id, name, producer, type, region, country, grape_variety, notes)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
          [wineId, cellarId, trimmedName, trimmedProducer, wineType],
        )
        await tx.execute(
          `INSERT INTO skus (id, wine_id, vintage, quantity, storage_location_id, status, purchase_price, purchase_date, purchase_location, shelf_location, trip_id, photo_path)
           VALUES (?, ?, ?, ?, NULL, 'in_stock', NULL, NULL, NULL, NULL, NULL, NULL)`,
          [skuId, wineId, vintage, quantity],
        )
      })

      if (photoFile) {
        try {
          // Same reasoning as AddDiscoverySheet's photo step: the wine row is
          // only queued locally above, so its photo upload (which authorizes
          // itself by looking the wine up server-side) would 404 and get
          // silently discarded if queued before that row lands remotely.
          // This direct, awaited PUT mirrors the CRUD connector's own insert
          // and is a no-op 23505 once that catches up.
          await apiMutate('PUT', `/wines/${wineId}`, {
            cellar_id: cellarId,
            name: trimmedName,
            producer: trimmedProducer,
            type: wineType,
          })

          const compressed = await compressImage(photoFile)
          const ext = ALLOWED_PHOTO_TYPES[compressed.type]
          if (ext) {
            const { family_id: familyId } = await db.get<{ family_id: string }>(
              'SELECT family_id FROM cellars WHERE id = ?',
              [cellarId],
            )
            const queue = getWineAttachmentQueue()
            const photoId = await queue.generateAttachmentId()
            const path = buildWinePhotoPath(familyId, wineId, photoId, ext)

            await queue.saveFile({
              id: photoId,
              data: await compressed.arrayBuffer(),
              fileExtension: ext,
              mediaType: compressed.type,
              metaData: JSON.stringify({ wineId }),
              updateHook: async innerTx => {
                await innerTx.execute(
                  'INSERT INTO wine_photos (id, wine_id, path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
                  [photoId, wineId, path, 0, new Date().toISOString()],
                )
              },
            })
          }
        } catch {
          // See comment above -- the wine stays saved, just without a photo.
        }
      }

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
        <Button size="icon-sm" variant="outline">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      } />
      <SheetContent side="bottom" className="pb-8 max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Wein hinzufügen</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="qs-name">Name *</Label>
            <Input
              id="qs-name"
              required
              placeholder="z.B. Barolo"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qs-producer">Produzent</Label>
            <Input
              id="qs-producer"
              placeholder="z.B. Gaja"
              value={producer}
              onChange={e => setProducer(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Typ</Label>
            <div className="flex gap-2">
              {WINE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setWineType(t.value)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    border: '1px solid',
                    cursor: 'pointer',
                    transition: 'background var(--duration-fast), color var(--duration-fast)',
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

          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <Label htmlFor="qs-quantity">Anzahl *</Label>
              <Input
                id="qs-quantity" name="quantity" type="number"
                min="1" max="999" defaultValue={1} required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qs-photo">Foto (Etikett)</Label>
            <Input
              id="qs-photo" type="file" accept="image/*"
              onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Hinzufügen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
