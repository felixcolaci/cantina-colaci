'use client'

import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useWineDetail } from '@/lib/powersync/queries'
import { WinePhotoGallery } from '@/app/app/wine-photo-gallery'
import { WineEditSheet } from '@/app/app/wine-edit-sheet'
import { AddSkuSheet } from '@/app/app/add-sku-sheet'
import { OpenBottleButton } from '@/app/app/open-bottle-button'
import { Skeleton } from '@/components/ui/skeleton'
import type { WineType } from '@/lib/types'

const TYPE_CONFIG: Record<WineType, { label: string; bg: string; fg: string; dot: string; hero: string }> = {
  red: {
    label: 'Rotwein',
    bg: 'var(--type-red-bg)',
    fg: 'var(--type-red-fg)',
    dot: '#7c2d12',
    hero: 'linear-gradient(160deg, #5b1e22 0%, #3d1417 55%, #2d1008 100%)',
  },
  white: {
    label: 'Weißwein',
    bg: 'var(--type-white-bg)',
    fg: 'var(--type-white-fg)',
    dot: '#c9a227',
    hero: 'linear-gradient(160deg, #9a7611 0%, #6b520d 55%, #4a3908 100%)',
  },
  'rosé': {
    label: 'Rosé',
    bg: 'var(--type-rose-bg)',
    fg: 'var(--type-rose-fg)',
    dot: '#c98a8f',
    hero: 'linear-gradient(160deg, #b06a72 0%, #7a3a40 55%, #3a1417 100%)',
  },
  sparkling: {
    label: 'Schaumwein',
    bg: 'var(--type-sparkling-bg)',
    fg: 'var(--type-sparkling-fg)',
    dot: '#5f8aac',
    hero: 'linear-gradient(160deg, #4f7390 0%, #2d4d64 55%, #1a2d3d 100%)',
  },
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export function WineDetailScreen({ wineId, cellarId }: { wineId: string; cellarId: string }) {
  const { wine, entries, tastings, isLoading } = useWineDetail(wineId)

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!wine) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Wein nicht gefunden.
        </p>
        <Link to="/" className="text-sm underline" style={{ color: 'var(--primary)' }}>
          Zurück zum Keller
        </Link>
      </div>
    )
  }

  const typeConf = TYPE_CONFIG[wine.type] ?? TYPE_CONFIG.red
  const inStockEntries = entries.filter(e => e.status === 'in_stock')
  const totalBottles = inStockEntries.reduce((sum, e) => sum + e.quantity, 0)

  return (
    <div className="max-w-lg mx-auto">
      <WinePhotoGallery wineId={wine.id} heroBg={typeConf.hero}>
        <Link
          to="/"
          className="absolute top-3 left-3 flex items-center gap-0.5 px-2.5 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', color: 'white' }}
        >
          <ChevronLeft className="h-4 w-4 -ml-0.5" />
          Keller
        </Link>

        <WineEditSheet wine={wine} />

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          {wine.producer && (
            <p style={{
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 3,
            }}>
              {wine.producer}
            </p>
          )}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.6rem, 6vw, 2rem)',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.05,
            letterSpacing: 'var(--tracking-tight)',
            margin: 0,
          }}>
            {wine.name}
          </h1>
        </div>
      </WinePhotoGallery>

      {/* Content */}
      <div className="px-4 py-5 space-y-6">
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1"
            style={{
              background: typeConf.bg,
              color: typeConf.fg,
              borderRadius: 'var(--radius-full)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              lineHeight: 1,
              height: 25,
            }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: typeConf.dot, flexShrink: 0,
                boxShadow: '0 0 0 1.5px color-mix(in oklab, currentColor 18%, transparent)',
              }}
            />
            {typeConf.label}
          </span>
          {wine.country && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
              {wine.country}
            </span>
          )}
          {wine.region && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
              {wine.region}
            </span>
          )}
          {wine.grapeVariety && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
              {wine.grapeVariety}
            </span>
          )}
        </div>

        {/* Keller section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow">Im Keller</p>
            <AddSkuSheet wineId={wine.id} cellarId={cellarId} />
          </div>
          {inStockEntries.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Keine Flaschen mehr vorhanden.
            </p>
          ) : (
            <div className="space-y-3">
              {inStockEntries.map(entry => (
                <div
                  key={entry.id}
                  className="rounded-xl p-4"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span
                      className="nums leading-none"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-4xl)',
                        fontWeight: 700,
                        color: 'var(--primary)',
                      }}
                    >
                      {entry.quantity}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      {entry.quantity === 1 ? 'Flasche' : 'Flaschen'}
                    </span>
                    {entry.vintage && (
                      <span
                        className="nums"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 'var(--text-lg)',
                          fontStyle: 'italic',
                          fontWeight: 500,
                          color: 'var(--muted-foreground)',
                          marginLeft: 'var(--space-1)',
                        }}
                      >
                        {entry.vintage}
                      </span>
                    )}
                  </div>

                  {(entry.storageLocationName || entry.shelfLocation) && (
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {[entry.storageLocationName, entry.shelfLocation].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {(entry.purchaseDate || entry.purchasePrice != null || entry.purchaseLocation) && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      {[
                        entry.purchaseDate
                          ? new Date(entry.purchaseDate).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
                          : null,
                        entry.purchasePrice != null ? formatMoney(entry.purchasePrice) : null,
                        entry.purchaseLocation,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}

                  <div className="mt-3">
                    <OpenBottleButton skuId={entry.id} quantity={entry.quantity} />
                  </div>
                </div>
              ))}
              {inStockEntries.length > 1 && (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Gesamt:{' '}
                  <span className="nums font-bold" style={{ color: 'var(--foreground)' }}>
                    {totalBottles}
                  </span>{' '}
                  Flaschen
                </p>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        {wine.notes && (
          <div>
            <p className="eyebrow mb-2">Notizen</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {wine.notes}
            </p>
          </div>
        )}

        {/* Tastings */}
        {tastings.length > 0 && (
          <div>
            <p className="eyebrow mb-3">Verkostungen ({tastings.length})</p>
            <div className="space-y-2">
              {tastings.map(t => (
                <div
                  key={t.id}
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex justify-between items-baseline">
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(t.date).toLocaleDateString('de-DE', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                    <span
                      className="nums font-bold"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-xl)',
                        color: 'var(--primary)',
                      }}
                    >
                      {t.rating}
                      <span style={{ fontSize: '0.65em', fontWeight: 400, color: 'var(--muted-foreground)' }}>
                        /5
                      </span>
                    </span>
                  </div>
                  {t.notes && (
                    <p className="mt-1.5 text-sm leading-snug" style={{ color: 'var(--foreground)' }}>
                      {t.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom breathing room */}
        <div className="h-2" />
      </div>
    </div>
  )
}
