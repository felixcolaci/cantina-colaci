'use client'

import { useState } from 'react'
import { useDiscoveries } from '@/lib/powersync/queries'
import { DiscoveryCard } from '@/components/cellar/discovery-card'
import { AddDiscoverySheet } from '@/app/app/add-discovery-sheet'
import { BackLink } from '@/app/app/back-link'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchField } from '@/components/ui/search-field'
import { Pagination } from '@/components/ui/pagination'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { useResettablePage } from '@/lib/hooks/use-resettable-page'

export function DiscoveriesScreen({ cellarId, userId }: { cellarId: string; userId: string }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useResettablePage(debouncedSearch)
  const { discoveries, totalPages, isLoading } = useDiscoveries(cellarId, debouncedSearch, page)

  return (
    <div className="px-4 pb-6 max-w-lg mx-auto space-y-4">
      <BackLink to="/" className="pt-6">Keller</BackLink>

      <div className="flex items-center justify-between">
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)', color: 'var(--foreground)', margin: 0,
        }}>
          Entdeckungen
        </h1>
        <AddDiscoverySheet cellarId={cellarId} userId={userId} />
      </div>

      <SearchField value={search} onChange={setSearch} placeholder="Entdeckungen suchen…" />

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : discoveries.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
          <p>
            {debouncedSearch
              ? 'Keine Entdeckungen gefunden.'
              : 'Noch keine Entdeckungen — der nächste Restaurant-Wein wartet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {discoveries.map(d => <DiscoveryCard key={d.id} discovery={d} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="pt-2" />
        </>
      )}
    </div>
  )
}
