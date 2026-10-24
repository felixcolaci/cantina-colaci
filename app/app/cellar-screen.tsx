'use client'

import { useState, type CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { Plane, History, Settings, Compass } from 'lucide-react'
import { useCellarWines, useCellar } from '@/lib/powersync/queries'
import { WineCard, BottleGlyph } from '@/components/cellar/wine-card'
import { CellarStatsPanel } from '@/components/cellar/cellar-stats'
import { QuickAddSheet } from '@/app/app/quick-add-sheet'
import { ImportWinesDialog } from '@/app/app/import-wines-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchField } from '@/components/ui/search-field'
import { Pagination } from '@/components/ui/pagination'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { useResettablePage } from '@/lib/hooks/use-resettable-page'
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

// Greeting changes with the time of day -- this screen is only ever
// rendered client-side (the whole SPA shell opts out of SSR, see
// app/app/[[...slug]]/page.tsx), so reading the clock directly on render
// can't cause a hydration mismatch.
function greeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'Guten Morgen'
  if (hour >= 11 && hour < 17) return 'Guten Tag'
  if (hour >= 17 && hour < 22) return 'Guten Abend'
  return 'Noch wach?'
}

export function CellarScreen({ cellarId }: { cellarId: string }) {
  const [type, setType] = useState<WineType | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useResettablePage(`${type ?? ''}:${debouncedSearch}`)
  const { wines, totalPages, isLoading } = useCellarWines(cellarId, type, debouncedSearch, page)
  const { name: cellarName } = useCellar(cellarId)

  return (
    <div className="px-4 pb-6">
      <div className="flex items-start justify-between gap-3 mb-5 pt-1">
        <div>
          <p className="eyebrow mb-1">{cellarName ?? 'Weinkeller'}</p>
          <h1
            className="display-hero"
            style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}
          >
            {greeting()}
          </h1>
        </div>
        <div className="flex-none flex items-center gap-2 pt-1">
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
          <Link to="/discoveries">
            <Button size="icon-sm" variant="outline" aria-label="Entdeckungen">
              <Compass className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link to="/settings/cellar">
            <Button size="icon-sm" variant="outline" aria-label="Einstellungen">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <ImportWinesDialog cellarId={cellarId} />
          <QuickAddSheet cellarId={cellarId} />
        </div>
      </div>

      <CellarStatsPanel cellarId={cellarId} />

      <p className="eyebrow mb-3">Dein Keller</p>

      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Wein oder Produzent suchen…"
        className="mb-3"
      />

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
            {debouncedSearch
              ? 'Keine Weine gefunden.'
              : type
                ? 'Keine Weine dieses Typs im Keller.'
                : 'Keine Weine im Keller.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {wines.map(wine => (
              <WineCard key={wine.id} wine={wine} totalBottles={wine.totalBottles} vintage={wine.vintage} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
        </>
      )}
    </div>
  )
}
