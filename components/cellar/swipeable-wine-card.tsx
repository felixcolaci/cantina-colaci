'use client'

import { useEffect, useRef, useState } from 'react'
import { WineCard } from './wine-card'
import { openBottle } from '@/lib/actions/tasting'
import { useServerAction } from '@/lib/hooks/use-server-action'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DatePicker } from '@/components/ui/date-picker'
import { RatingInput } from '@/components/ui/rating-input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Wine, Sku } from '@/lib/types'

const REVEAL_W = 82     // width of the action strip when snapped open
const SNAP_AT   = 52    // minimum swipe distance to snap open
const FULL_AT   = 190   // full-swipe distance → auto-open sheet

export function SwipeableWineCard({
  wine, skus, vintage, firstSkuId,
}: {
  wine: Wine
  skus: Pick<Sku, 'quantity' | 'photo_url'>[]
  vintage: number | null
  firstSkuId: string | null
}) {
  const [tastingOpen, setTastingOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cardRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    const card    = cardRef.current
    if (!wrapper || !card) return

    let startX = 0, startY = 0
    let dir: 'h' | 'v' | null = null
    let revealed = false
    let didSwipe = false

    const move = (x: number, animated: boolean) => {
      card.style.transition = animated
        ? 'transform 0.28s cubic-bezier(0.2, 0, 0, 1)'
        : 'none'
      card.style.transform = `translateX(${-Math.max(0, x)}px)`
    }

    const snap = (open: boolean) => {
      move(open ? REVEAL_W : 0, true)
      revealed = open
    }

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      dir = null
      didSwipe = false
    }

    const onTouchMove = (e: TouchEvent) => {
      const dx = startX - e.touches[0].clientX
      const dy = e.touches[0].clientY - startY

      if (dir === null) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
        dir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
      }
      if (dir !== 'h') return

      // Left swipe only (dx > 0), or dragging back when revealed
      const base   = revealed ? REVEAL_W : 0
      const offset = base + dx
      if (offset < 0) return

      e.preventDefault()
      move(Math.min(offset, 260), false)
      if (Math.abs(dx) > 6) didSwipe = true
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (dir !== 'h') return
      const dx     = startX - e.changedTouches[0].clientX
      const total  = (revealed ? REVEAL_W : 0) + dx

      if (total >= FULL_AT && firstSkuId) {
        snap(false)
        setTimeout(() => setTastingOpen(true), 200)
      } else if (total >= SNAP_AT) {
        snap(true)
      } else {
        snap(false)
      }
    }

    // Capture-phase click: prevent Link navigation if a swipe happened
    const onClickCapture = (e: MouseEvent) => {
      if (didSwipe) {
        e.preventDefault()
        e.stopPropagation()
        didSwipe = false
        if (revealed) snap(false)
      }
    }

    wrapper.addEventListener('touchstart', onTouchStart, { passive: true })
    wrapper.addEventListener('touchmove',  onTouchMove,  { passive: false })
    wrapper.addEventListener('touchend',   onTouchEnd,   { passive: true })
    wrapper.addEventListener('click',      onClickCapture, true)

    return () => {
      wrapper.removeEventListener('touchstart', onTouchStart)
      wrapper.removeEventListener('touchmove',  onTouchMove)
      wrapper.removeEventListener('touchend',   onTouchEnd)
      wrapper.removeEventListener('click',      onClickCapture, true)
    }
  }, [firstSkuId])

  return (
    <>
      <div ref={wrapperRef} style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Action strip — visible behind card when swiped */}
        {firstSkuId && (
          <div
            aria-hidden="true"
            onClick={() => setTastingOpen(true)}
            style={{
              position: 'absolute', inset: 0, left: 'auto',
              width: REVEAL_W,
              zIndex: 0,
              background: 'var(--primary)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 5, cursor: 'pointer',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <WineGlassIcon />
            <span style={{
              color: 'rgba(255,255,255,0.92)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}>
              Verkosten
            </span>
          </div>
        )}

        {/* The card itself — slides left on swipe, sits above the action strip */}
        <div ref={cardRef} style={{ borderRadius: 'var(--radius-lg)', position: 'relative', zIndex: 1 }}>
          <WineCard wine={wine} skus={skus} vintage={vintage} />
        </div>
      </div>

      {firstSkuId && (
        <TastingSheet
          skuId={firstSkuId}
          open={tastingOpen}
          onOpenChange={setTastingOpen}
        />
      )}
    </>
  )
}

function TastingSheet({ skuId, open, onOpenChange }: {
  skuId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]     = useState<string | null>(today)
  const [rating, setRating] = useState<number | null>(null)
  const { run, isPending, error } = useServerAction(openBottle)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Verkostung</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={e => { e.preventDefault(); run(new FormData(e.currentTarget)) }}
          className="space-y-4 mt-4"
        >
          <input type="hidden" name="cellar_entry_id" value={skuId} />
          <input type="hidden" name="redirect_to" value="/cellar" />

          <div className="space-y-2">
            <Label>Datum</Label>
            <DatePicker mode="full" name="date" value={date} onChange={v => setDate(v as string | null)} placeholder="Datum" />
          </div>
          <div className="space-y-2">
            <Label>Bewertung</Label>
            <RatingInput name="rating" value={rating} onChange={setRating} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="swipe-notes">Notizen</Label>
            <Textarea id="swipe-notes" name="notes" placeholder="Duft, Geschmack, Begleitung…" />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}
          <SubmitButton isPending={isPending} className="w-full">Speichern</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function WineGlassIcon() {
  return (
    <svg
      width="20" height="26" viewBox="0 0 20 26"
      fill="none"
      stroke="rgba(255,255,255,0.9)"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3h14" />
      <path d="M4 3 Q4.5 12 10 15 Q15.5 12 16 3" />
      <line x1="10" y1="15" x2="10" y2="21" />
      <line x1="6"  y1="21" x2="14" y2="21" />
    </svg>
  )
}
