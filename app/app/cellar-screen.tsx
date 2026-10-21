'use client'

import { useState, type CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { Plane, History, Users, Settings } from 'lucide-react'
import { useCellarWines } from '@/lib/powersync/queries'
import { WineCard, BottleGlyph } from '@/components/cellar/wine-card'
import { QuickAddSheet } from '@/app/app/quick-add-sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { WineType } from '@/lib/types'

const WINE_TYPES: { value: WineType; label: string }[] = [
  { value: 'red', label: 'Rotwein' },
  { value: 'white', label: 'Weißwein' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Schaumwein' },
]

function chipStyle(active: boolean): CSSProperties {
  return {
    flexShrink: 0,
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-body)',
    border: active ? 'none' : '1px solid var(--border)',
    background: active ? 'var(--primary)' : 'var(--background)',
    color: active ? 'var(--primary-foreground)' : 'var(--foreground)',
    transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
    whiteSpace: 'nowrap',
  }
}

export function CellarScreen({ cellarId }: { cellarId: string }) {
  const [type, setType] = useState<WineType | null>(null)
  const { wines, isLoading } = useCellarWines(cellarId, type)

  return (
    <div className="px-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)' }}>
          Weinkeller
        </h2>
        <div className="flex items-center gap-2">
          <Link to="/family">
            <Button size="icon-sm" variant="outline" aria-label="Familie">
              <Users className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link to="/history">
            <Button size="icon-sm" variant="outline" aria-label="Kellerchronik">
              <History className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link to="/trips">
            <Button size="icon-sm" variant="outline" aria-label="Reisen">
              <Plane className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link to="/settings/cellar">
            <Button size="icon-sm" variant="outline" aria-label="Einstellungen">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <QuickAddSheet cellarId={cellarId} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <button type="button" style={chipStyle(!type)} onClick={() => setType(null)}>
          Alle
        </button>
        {WINE_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            style={chipStyle(type === t.value)}
            onClick={() => setType(type === t.value ? null : t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : wines.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BottleGlyph width={32} height={64} opacity={0.5} />
          <p className="mt-3">
            {type ? 'Keine Weine dieses Typs im Keller.' : 'Keine Weine im Keller.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {wines.map(wine => (
            <WineCard key={wine.id} wine={wine} totalBottles={wine.totalBottles} vintage={wine.vintage} />
          ))}
        </div>
      )}
    </div>
  )
}
