'use client'

import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { addWinePhoto, deleteWinePhoto } from '@/lib/actions/wine-photos'
import { compressImage } from '@/lib/image-compress'
import { useServerAction } from '@/lib/hooks/use-server-action'

type Photo = { id: string; url: string }

export function PhotoGallery({
  photos,
  wineId,
  fallbackUrl,
  heroBg,
  children,
}: {
  photos: Photo[]
  wineId: string
  fallbackUrl: string | null
  heroBg: string
  children: React.ReactNode
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const { run: runAdd, isPending: addPending } = useServerAction(addWinePhoto)
  const { run: runDelete, isPending: deletePending } = useServerAction(deleteWinePhoto)

  const slides: Photo[] =
    photos.length > 0
      ? photos
      : fallbackUrl
        ? [{ id: '__legacy__', url: fallbackUrl }]
        : []

  const hasPhotos = slides.length > 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const compressed = await compressImage(file)
    const fd = new FormData()
    fd.append('wine_id', wineId)
    fd.append('photo', compressed)
    runAdd(fd)
  }

  function handleDelete(photoId: string) {
    const fd = new FormData()
    fd.append('wine_id', wineId)
    fd.append('photo_id', photoId)
    runDelete(fd)
  }

  return (
    <div className="relative" style={{ height: 224 }}>
      {/* Background */}
      {hasPhotos ? (
        <div
          className="absolute inset-0 flex overflow-x-auto"
          style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
          onScroll={e => {
            const el = e.currentTarget
            setCurrentIndex(Math.round(el.scrollLeft / el.clientWidth))
          }}
        >
          {slides.map(photo => (
            <div
              key={photo.id}
              className="relative flex-none w-full h-full"
              style={{ scrollSnapAlign: 'start' }}
            >
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              {photo.id !== '__legacy__' && (
                <button
                  onClick={() => handleDelete(photo.id)}
                  disabled={deletePending}
                  className="absolute bottom-16 right-3 flex items-center justify-center w-8 h-8 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'white' }}
                  aria-label="Foto löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: heroBg }}>
          <div className="absolute inset-0 flex items-center justify-center opacity-15">
            <svg width="48" height="120" viewBox="0 0 24 60" fill="none"
              stroke="white" strokeWidth="1.2" strokeLinejoin="round">
              <path d="M9 2h6v9.5c0 1.5 1 2.5 2 3.8 1.8 2 3 3.8 3 7.7v29a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 2 52V23c0-3.9 1.2-5.7 3-7.7 1-1.3 2-2.3 2-3.8V2Z" />
              <line x1="2.5" y1="37" x2="21.5" y2="37" />
            </svg>
          </div>
        </div>
      )}

      {/* Scrim */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }}
      />

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
          {slides.map((_, i) => (
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

      {/* Camera button — sits left of the edit button (right-14) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={addPending}
        className="absolute top-3 right-14 flex items-center justify-center w-8 h-8 rounded-full"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', color: 'white' }}
        aria-label="Foto hinzufügen"
      >
        {addPending ? (
          <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />

      {/* Overlaid content: back link, edit button, wine name */}
      {children}
    </div>
  )
}
