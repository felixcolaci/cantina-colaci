'use client'

import { useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Trash2 } from 'lucide-react'
import { apiGet, apiMutate, apiUpload } from '@/lib/spa/api-client'
import { compressImage } from '@/lib/image-compress'
import { BottleGlyph } from '@/components/cellar/wine-card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Photo = { id: string; url: string }

// wine_photos is deliberately not a PowerSync-synced table (binary-heavy,
// see lib/powersync/schema.ts's comment) -- reads go through plain
// react-query + GET /api/v1/wines/[id]/photos instead of a local SQL query,
// and writes go straight to the network (apiUpload/apiMutate), not the
// PowerSync CRUD queue. There's therefore no offline photo upload yet; an
// upload or delete attempted while offline just fails with the generic
// network error below, same as any other direct fetch would.
export function WinePhotoGallery({
  wineId,
  heroBg,
  children,
}: {
  wineId: string
  heroBg: string
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const queryKey = ['wine-photos', wineId]
  const { data } = useQuery<{ photos: Photo[] }>({
    queryKey,
    queryFn: () => apiGet<{ photos: Photo[] }>(`/wines/${wineId}/photos`),
  })
  const photos = data?.photos ?? []
  const hasPhotos = photos.length > 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setIsUploading(true)
    try {
      const compressed = await compressImage(file)
      const formData = new FormData()
      formData.append('photo', compressed)
      await apiUpload(`/wines/${wineId}/photos`, formData)
      await queryClient.invalidateQueries({ queryKey })
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
      await apiMutate('DELETE', `/wines/${wineId}/photos/${photoId}`)
      await queryClient.invalidateQueries({ queryKey })
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
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
                preload={index === 0}
              />
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
