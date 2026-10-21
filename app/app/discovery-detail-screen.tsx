'use client'

import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useDiscoveryDetail } from '@/lib/powersync/queries'
import { DiscoveryPhotoPanel } from '@/app/app/discovery-photo-panel'
import { DiscoveryEditSheet } from '@/app/app/discovery-edit-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { WineType } from '@/lib/types'

const TYPE_CONFIG: Record<WineType, { label: string; bg: string; fg: string; dot: string; hero: string }> = {
  red: {
    label: 'Rotwein', bg: 'var(--type-red-bg)', fg: 'var(--type-red-fg)', dot: '#7c2d12',
    hero: 'linear-gradient(160deg, #5b1e22 0%, #3d1417 55%, #2d1008 100%)',
  },
  white: {
    label: 'Weißwein', bg: 'var(--type-white-bg)', fg: 'var(--type-white-fg)', dot: '#c9a227',
    hero: 'linear-gradient(160deg, #9a7611 0%, #6b520d 55%, #4a3908 100%)',
  },
  'rosé': {
    label: 'Rosé', bg: 'var(--type-rose-bg)', fg: 'var(--type-rose-fg)', dot: '#c98a8f',
    hero: 'linear-gradient(160deg, #b06a72 0%, #7a3a40 55%, #3a1417 100%)',
  },
  sparkling: {
    label: 'Schaumwein', bg: 'var(--type-sparkling-bg)', fg: 'var(--type-sparkling-fg)', dot: '#5f8aac',
    hero: 'linear-gradient(160deg, #4f7390 0%, #2d4d64 55%, #1a2d3d 100%)',
  },
}
const FALLBACK_HERO = 'linear-gradient(160deg, var(--muted) 0%, var(--secondary) 100%)'

export function DiscoveryDetailScreen({ discoveryId }: { discoveryId: string }) {
  const { discovery, isLoading } = useDiscoveryDetail(discoveryId)

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!discovery) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Entdeckung nicht gefunden.
        </p>
        <Link to="/discoveries" className="text-sm underline" style={{ color: 'var(--primary)' }}>
          Zurück zu Entdeckungen
        </Link>
      </div>
    )
  }

  const typeConf = discovery.type ? TYPE_CONFIG[discovery.type] : null
  const fundort = discovery.tripName ?? discovery.locationText

  return (
    <div className="max-w-lg mx-auto">
      <DiscoveryPhotoPanel discoveryId={discovery.id} cellarId={discovery.cellarId} heroBg={typeConf?.hero ?? FALLBACK_HERO}>
        <Link
          to="/discoveries"
          className="absolute top-3 left-3 flex items-center gap-0.5 px-2.5 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', color: 'white' }}
        >
          <ChevronLeft className="h-4 w-4 -ml-0.5" />
          Entdeckungen
        </Link>

        <DiscoveryEditSheet discovery={discovery} cellarId={discovery.cellarId} />

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          {discovery.producer && (
            <p style={{
              color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
              fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3,
            }}>
              {discovery.producer}
            </p>
          )}
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 6vw, 2rem)', fontWeight: 700,
            color: 'white', lineHeight: 1.05, letterSpacing: 'var(--tracking-tight)', margin: 0,
          }}>
            {discovery.name}
            {discovery.vintage && (
              <span className="nums" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontStyle: 'italic' }}>
                {' '}{discovery.vintage}
              </span>
            )}
          </h1>
        </div>
      </DiscoveryPhotoPanel>

      <div className="px-4 py-5 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {typeConf && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1"
              style={{
                background: typeConf.bg, color: typeConf.fg, borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 500,
                letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1, height: 25,
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: typeConf.dot, flexShrink: 0,
                boxShadow: '0 0 0 1.5px color-mix(in oklab, currentColor 18%, transparent)',
              }} />
              {typeConf.label}
            </span>
          )}
          {discovery.rating != null && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
              <span className="nums">{discovery.rating}</span>/5
            </span>
          )}
        </div>

        <div className="space-y-1">
          <p className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)' }}>
            {[fundort, new Date(discovery.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })]
              .filter(Boolean).join(' · ')}
          </p>
          {(discovery.price != null || discovery.createdByName) && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {[
                discovery.price != null
                  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(discovery.price)
                  : null,
                discovery.createdByName ? `Entdeckt von ${discovery.createdByName}` : null,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {discovery.notes && (
          <div>
            <p className="eyebrow mb-2">Notizen</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)', fontStyle: 'italic' }}>
              {discovery.notes}
            </p>
          </div>
        )}

        <div className="h-2" />
      </div>
    </div>
  )
}
