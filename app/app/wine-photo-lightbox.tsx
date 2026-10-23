'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ChevronLeft, ChevronRight, XIcon } from 'lucide-react'
import { Dialog, DialogClose, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import type { GalleryPhoto } from '@/lib/powersync/queries'

// Fullscreen on mobile, a centered modal from `sm:` up -- swipeable via
// native scroll-snap (same technique as WinePhotoGallery's hero), plus
// click-through chevrons for pointer/desktop use.
export function WinePhotoLightbox({
  photos,
  initialIndex,
  open,
  onOpenChange,
}: {
  photos: GalleryPhoto[]
  initialIndex: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(initialIndex)

  // Reset the dot/counter state during render (not in an effect) whenever
  // the dialog transitions open, so it reflects the newly-tapped photo.
  const [syncedOpen, setSyncedOpen] = useState(open)
  if (open !== syncedOpen) {
    setSyncedOpen(open)
    if (open) setIndex(initialIndex)
  }

  useEffect(() => {
    if (!open) return
    // Jump instantly to the tapped photo -- no scroll animation on open.
    const el = scrollerRef.current
    if (el) el.scrollLeft = initialIndex * el.clientWidth
  }, [open, initialIndex])

  function scrollToIndex(next: number) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/90 sm:bg-black/70" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="fixed inset-0 z-50 bg-black outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 sm:inset-6 sm:m-auto sm:h-[min(640px,calc(100%-3rem))] sm:w-[min(720px,calc(100%-3rem))] sm:rounded-2xl sm:overflow-hidden"
          onKeyDown={e => {
            if (e.key === 'ArrowLeft' && index > 0) scrollToIndex(index - 1)
            if (e.key === 'ArrowRight' && index < photos.length - 1) scrollToIndex(index + 1)
          }}
        >
          <div
            ref={scrollerRef}
            className="absolute inset-0 flex h-full w-full overflow-x-auto"
            style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
            onScroll={e => {
              const el = e.currentTarget
              setIndex(Math.round(el.scrollLeft / el.clientWidth))
            }}
          >
            {photos.map(photo => (
              <div key={photo.id} className="relative h-full w-full flex-none" style={{ scrollSnapAlign: 'start' }}>
                <Image src={photo.url} alt="" fill sizes="100vw" className="object-contain" unoptimized />
              </div>
            ))}
          </div>

          <DialogClose
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'white' }}
            aria-label="Schließen"
          >
            <XIcon className="h-4 w-4" />
          </DialogClose>

          {photos.length > 1 && (
            <>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => scrollToIndex(index - 1)}
                  className="absolute top-1/2 left-3 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full sm:flex"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'white' }}
                  aria-label="Vorheriges Foto"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {index < photos.length - 1 && (
                <button
                  type="button"
                  onClick={() => scrollToIndex(index + 1)}
                  className="absolute top-1/2 right-3 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full sm:flex"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: 'white' }}
                  aria-label="Nächstes Foto"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-1.5">
                {photos.map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: i === index ? 16 : 6,
                      height: 6,
                      background: i === index ? 'white' : 'rgba(255,255,255,0.45)',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
