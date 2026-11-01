'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
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
// optional photos are the one exception, same pattern as AddDiscoverySheet
// (app/app/add-discovery-sheet.tsx): each needs a direct, awaited network step.
export function QuickAddSheet({ cellarId }: { cellarId: string }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [producer, setProducer] = useState('')
  const [wineType, setWineType] = useState<WineType>('red')
  const [vintage, setVintage] = useState<number | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // One object URL per selected file, recreated whenever the file list
  // changes and revoked on the next change or unmount -- never left to leak.
  const previewUrls = useMemo(() => photoFiles.map(f => URL.createObjectURL(f)), [photoFiles])
  useEffect(() => () => previewUrls.forEach(u => URL.revokeObjectURL(u)), [previewUrls])

  function reset() {
    setName('')
    setProducer('')
    setWineType('red')
    setVintage(null)
    setPhotoFiles([])
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    const formData = new FormData(e.currentTarget)
    const quantity = parseInt(formData.get('quantity') as string, 10)
    const purchasePriceRaw = formData.get('purchase_price') as string
    const purchasePrice = purchasePriceRaw ? parseFloat(purchasePriceRaw) : null

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
           VALUES (?, ?, ?, ?, NULL, 'in_stock', ?, NULL, NULL, NULL, NULL, NULL)`,
          [skuId, wineId, vintage, quantity, purchasePrice],
        )
      })

      if (photoFiles.length > 0) {
        try {
          // Best-effort head start, not a prerequisite: if this lands before
          // the queue below tries to upload bytes, it avoids a 404 (the wine
          // row is otherwise only queued locally above, and the bytes upload
          // authorizes itself by looking the wine up server-side). Offline,
          // this just throws and is ignored -- the photo queues below
          // regardless, and a failed byte upload retries indefinitely (no
          // errorHandler configured, see attachment-queues.ts) until the
          // wine row itself has synced. This mirrors the CRUD connector's
          // own insert and is a no-op 23505 once that catches up.
          await apiMutate('PUT', `/wines/${wineId}`, {
            cellar_id: cellarId,
            name: trimmedName,
            producer: trimmedProducer,
            type: wineType,
          })
        } catch {
          // See comment above -- queuing the photos below doesn't depend on this.
        }

        const { family_id: familyId } = await db.get<{ family_id: string }>(
          'SELECT family_id FROM cellars WHERE id = ?',
          [cellarId],
        )
        const queue = getWineAttachmentQueue()

        // Uploaded sequentially (same as WinePhotoGallery's own camera
        // button) so sort_order comes out in picker order and one failure
        // can't crowd out the others sharing a queue/compression worker.
        for (let sortOrder = 0; sortOrder < photoFiles.length; sortOrder++) {
          try {
            const compressed = await compressImage(photoFiles[sortOrder])
            const ext = ALLOWED_PHOTO_TYPES[compressed.type]
            if (!ext) continue // e.g. ProRAW (.dng)

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
                  [photoId, wineId, path, sortOrder, new Date().toISOString()],
                )
              },
            })
          } catch {
            // See comment above -- the wine stays saved, just missing this one photo.
          }
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
            <Label htmlFor="qs-purchase-price">Preis (€)</Label>
            <Input id="qs-purchase-price" name="purchase_price" type="number" step="0.01" min="0" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qs-photo">Fotos (Etikett)</Label>
            <Input
              id="qs-photo" type="file" accept="image/*" multiple
              onChange={e => {
                setPhotoFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])
                e.target.value = ''
              }}
            />
            {photoFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {previewUrls.map((url, index) => (
                  <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- transient local blob: preview, not worth next/image's config here */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoFiles(prev => prev.filter((_, i) => i !== index))}
                      className="absolute top-0.5 right-0.5 flex items-center justify-center w-5 h-5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
                      aria-label="Foto entfernen"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Hinzufügen</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}
