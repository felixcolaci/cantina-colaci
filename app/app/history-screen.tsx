'use client'

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTastingsHistory } from '@/lib/powersync/queries'
import { TastingCard } from '@/components/cellar/tasting-card'
import { BackLink } from '@/app/app/back-link'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchField } from '@/components/ui/search-field'
import { Pagination } from '@/components/ui/pagination'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { useResettablePage } from '@/lib/hooks/use-resettable-page'

export function HistoryScreen({ cellarId }: { cellarId: string }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useResettablePage(debouncedSearch)
  const { tastings, totalPages, isLoading } = useTastingsHistory(cellarId, debouncedSearch, page)

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <BackLink to="/">Keller</BackLink>

      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-3xl)',
        fontWeight: 600,
        letterSpacing: 'var(--tracking-tight)',
        color: 'var(--foreground)',
        margin: 0,
      }}>
        Kellerchronik
      </h1>

      <SearchField value={search} onChange={setSearch} placeholder="Wein, Produzent oder Notiz suchen…" />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : tastings.length === 0 ? (
        <p className="text-center py-10" style={{ color: 'var(--muted-foreground)' }}>
          {debouncedSearch ? 'Keine Verkostungen gefunden.' : 'Noch keine Verkostungen — apri una bottiglia!'}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {tastings.map(tasting => (
              <Link key={tasting.id} to="/wine/$id" params={{ id: tasting.wineId }} className="block">
                <TastingCard
                  tasting={{ id: tasting.id, date: tasting.date, rating: tasting.rating, notes: tasting.notes }}
                  wine={{ name: tasting.wineName, producer: tasting.wineProducer, vintage: tasting.vintage }}
                />
              </Link>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
