'use client'

import { useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { usePowerSync } from '@powersync/react'
import { Camera, Trash2 } from 'lucide-react'
import { getWineAttachmentQueue } from '@/lib/powersync/PowerSyncProvider'
import { useWinePhotos } from '@/lib/powersync/queries'
import { compressImage } from '@/lib/image-compress'
import { ALLOWED_PHOTO_TYPES, buildWinePhotoPath } from '@/lib/storage/wine-photos'
import { BottleGlyph } from '@/components/cellar/wine-card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// wine_photos is a PowerSync-synced table (metadata only) read reactively
// via useWinePhotos, not a network fetch -- a photo taken offline appears
// here immediately (pending: true) and its bytes upload in the background
// through the wine AttachmentQueue (lib/powersync/attachment-queues.ts),
// automatically retried on reconnect. There is therefore no "upload
// failed" error path here anymore: a failed/queued upload just stays
// pending until it succeeds.
export function WinePhotoGallery({
  wineId,
  heroBg,
  children,
}: {
  wineId: string
  heroBg: string
  children: ReactNode
}) {
  const db = usePowerSync()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { photos } = useWinePhotos(wineId)
  const hasPhotos = photos.length > 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setIsUploading(true)
    try {
      const compressed = await compressImage(file)
      const ext = ALLOWED_PHOTO_TYPES[compressed.type]
      if (!ext) return // unsupported format -- same silent no-op as before

      const { family_id: familyId } = await db.get<{ family_id: string }>(
        'SELECT cellars.family_id AS family_id FROM wines JOIN cellars ON cellars.id = wines.cellar_id WHERE wines.id = ?',
        [wineId],
      )

      const queue = getWineAttachmentQueue()
      const id = await queue.generateAttachmentId()
      const path = buildWinePhotoPath(familyId, wineId, id, ext)
      const nextSortOrder = photos.length

      await queue.saveFile({
        id,
        data: await compressed.arrayBuffer(),
        fileExtension: ext,
        mediaType: compressed.type,
        metaData: JSON.stringify({ wineId }),
        updateHook: async tx => {
          await tx.execute(
            'INSERT INTO wine_photos (id, wine_id, path, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
            [id, wineId, path, nextSortOrder, new Date().toISOString()],
          )
        },
      })
    } catch {
      // Degrades to "nothing changed" -- the camera button stays available
      // to retry.
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete(photoId: string) {
    setIsDeleting(true)
    try {
      const url = photos.find(p => p.id === photoId)?.url
      await getWineAttachmentQueue().deleteFile({
        id: photoId,
        updateHook: async tx => {
          await tx.execute('DELETE FROM wine_photos WHERE id = ?', [photoId])
        },
      })
      // Best-effort: Cache Storage holds the bytes, not the metadata row --
      // nothing re-requests this URL once it's gone, but no reason to keep
      // it occupying cache quota either.
      if (url) await caches.open('photo-cache').then(c => c.delete(url)).catch(() => {})
    } catch {
      // see handleFileChange
    } finally {
      setIsDeleting(false)
      setPendingDeleteId(null)
    }
  }

  return (
    <div className="relative" style={{ height: 224 }}>
      {hasPhotos ? (
        <div
          className="absolute inset-0 flex overflow-x-auto"
          style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
          onScroll={e => {
            const el = e.currentTarget
            setCurrentIndex(Math.round(el.scrollLeft / el.clientWidth))
          }}
        >
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative flex-none w-full h-full" style={{ scrollSnapAlign: 'start' }}>
              {photo.pending ? (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: heroBg }}>
                  <div style={{ opacity: 0.35 }}>
                    <BottleGlyph width={48} height={120} opacity={1} />
                  </div>
                </div>
              ) : (
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover"
                  preload={index === 0}
                  unoptimized
                />
              )}
              {photo.pending && (
                <div
                  className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'white' }}
                >
                  <div
                    className="w-3 h-3 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                  />
                  <span className="text-xs">wird hochgeladen</span>
                </div>
              )}
              <button
                onClick={() => setPendingDeleteId(photo.id)}
                disabled={isDeleting}
                className="absolute bottom-16 right-3 flex items-center justify-center w-8 h-8 rounded-full"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'white' }}
                aria-label="Foto löschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: heroBg }}>
          <div style={{ opacity: 0.35 }}>
            <BottleGlyph width={48} height={120} opacity={1} />
          </div>
        </div>
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }}
      />

      {photos.length > 1 && (
        <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
          {photos.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === currentIndex ? 16 : 6,
                height: 6,
                background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </div>
      )}

      {/* Camera button -- sits left of the edit button (right-14) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="absolute top-3 right-14 flex items-center justify-center w-8 h-8 rounded-full"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', color: 'white' }}
        aria-label="Foto hinzufügen"
      >
        {isUploading ? (
          <div
            className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
          />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />

      {/* Overlaid content: back link, edit button, wine name */}
      {children}

      <Dialog open={pendingDeleteId !== null} onOpenChange={open => { if (!open) setPendingDeleteId(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Foto löschen?</DialogTitle>
            <DialogDescription>Das Foto wird unwiderruflich gelöscht.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Abbrechen</DialogClose>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => { if (pendingDeleteId) handleDelete(pendingDeleteId) }}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
