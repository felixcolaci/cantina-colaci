'use client'

import { useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { usePowerSync } from '@powersync/react'
import { Camera, Trash2 } from 'lucide-react'
import { getDiscoveryAttachmentQueue } from '@/lib/powersync/PowerSyncProvider'
import { useDiscoveryPhoto } from '@/lib/powersync/queries'
import { compressImage } from '@/lib/image-compress'
import { ALLOWED_PHOTO_TYPES, buildDiscoveryPhotoPath } from '@/lib/storage/wine-photos'
import { BottleGlyph } from '@/components/cellar/wine-card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Single-photo counterpart to WinePhotoGallery (app/app/wine-photo-gallery.tsx) --
// a discovery has at most one photo (see discovery_photos' shape and
// AddDiscoverySheet's "replace, don't add to" comment), so there is no
// carousel here, just add/replace/delete on that one slot.
export function DiscoveryPhotoPanel({
  discoveryId,
  cellarId,
  heroBg,
  children,
}: {
  discoveryId: string
  cellarId: string
  heroBg: string
  children: ReactNode
}) {
  const db = usePowerSync()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { photo } = useDiscoveryPhoto(discoveryId)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setIsUploading(true)
    try {
      const compressed = await compressImage(file)
      const ext = ALLOWED_PHOTO_TYPES[compressed.type]
      if (!ext) return // unsupported format -- same silent no-op as WinePhotoGallery

      const { family_id: familyId } = await db.get<{ family_id: string }>(
        'SELECT family_id FROM cellars WHERE id = ?',
        [cellarId],
      )

      const queue = getDiscoveryAttachmentQueue()
      const photoId = await queue.generateAttachmentId()
      const path = buildDiscoveryPhotoPath(familyId, discoveryId, photoId, ext)

      await queue.saveFile({
        id: photoId,
        data: await compressed.arrayBuffer(),
        fileExtension: ext,
        mediaType: compressed.type,
        metaData: JSON.stringify({ discoveryId }),
        // Same replace-not-append rule as AddDiscoverySheet -- only one row
        // per discovery, so a new photo retires whatever was there before.
        updateHook: async tx => {
          await tx.execute('DELETE FROM discovery_photos WHERE discovery_id = ?', [discoveryId])
          await tx.execute(
            'INSERT INTO discovery_photos (id, discovery_id, path, created_at) VALUES (?, ?, ?, ?)',
            [photoId, discoveryId, path, new Date().toISOString()],
          )
        },
      })
    } catch (err) {
      // TEMPORARY diagnostic (remove once the silent-failure cause is found) --
      // the normal silent "nothing changed, camera button stays available to
      // retry" catch was hiding a real error with zero way to see it remotely.
      window.alert(`Foto-Upload-Fehler (debug): ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete() {
    if (!photo) return
    setIsDeleting(true)
    try {
      await getDiscoveryAttachmentQueue().deleteFile({
        id: photo.id,
        updateHook: async tx => {
          await tx.execute('DELETE FROM discovery_photos WHERE discovery_id = ?', [discoveryId])
        },
      })
      await caches.open('photo-cache').then(c => c.delete(photo.url)).catch(() => {})
    } catch {
      // see handleFileChange
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="relative" style={{ height: 224 }}>
      {photo && !photo.pending && (
        <Image src={photo.url} alt="" fill sizes="100vw" className="object-cover" unoptimized />
      )}
      {(!photo || photo.pending) && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: heroBg }}>
          <div style={{ opacity: 0.35 }}>
            <BottleGlyph width={48} height={120} opacity={1} />
          </div>
        </div>
      )}
      {photo?.pending && (
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

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }}
      />

      {photo && !photo.pending && (
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={isDeleting}
          className="absolute bottom-3 right-3 flex items-center justify-center w-8 h-8 rounded-full"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'white' }}
          aria-label="Foto löschen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Camera button -- sits left of the edit button (right-14) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="absolute top-3 right-14 flex items-center justify-center w-8 h-8 rounded-full"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', color: 'white' }}
        aria-label={photo ? 'Foto ersetzen' : 'Foto hinzufügen'}
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

      {/* Overlaid content: back link, edit button, discovery name */}
      {children}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Foto löschen?</DialogTitle>
            <DialogDescription>Das Foto wird unwiderruflich gelöscht.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Abbrechen</DialogClose>
            <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
