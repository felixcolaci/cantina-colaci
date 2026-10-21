'use client'

import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useQuery as useRQuery } from '@tanstack/react-query'
import { apiGet, ApiError } from '@/lib/spa/api-client'
import { useCellar } from '@/lib/powersync/queries'
import { ResetCellarSheet } from '@/app/app/reset-cellar-sheet'
import { StartOwnCellarSheet } from '@/app/app/start-own-cellar-sheet'
import { Skeleton } from '@/components/ui/skeleton'

type FamilyResponse = { familyName: string; isDemo: boolean; role: string }

export function CellarSettingsScreen({ cellarId }: { cellarId: string }) {
  const { name: cellarName, isLoading: cellarLoading } = useCellar(cellarId)
  // Shares the ['family'] query cache with FamilyScreen -- role/isDemo come
  // from the same admin-verified GET /api/v1/family response there.
  const { data, isLoading: familyLoading, error } = useRQuery<FamilyResponse>({
    queryKey: ['family'],
    queryFn: () => apiGet<FamilyResponse>('/family'),
  })

  const isLoading = cellarLoading || familyLoading

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <Link to="/" className="inline-flex items-center gap-0.5 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
        <ChevronLeft className="h-4 w-4 -ml-0.5" />
        Keller
      </Link>

      <div>
        <p className="eyebrow mb-1">Einstellungen</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600, letterSpacing: 'var(--tracking-tight)', margin: 0 }}>
          {cellarLoading ? '…' : cellarName ?? 'Keller'}
        </h1>
      </div>

      <Link to="/settings/locations" className="text-sm underline" style={{ color: 'var(--primary)' }}>
        Lagerorte verwalten →
      </Link>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error || !data ? (
        <p className="text-sm" style={{ color: 'var(--destructive)' }}>
          {error instanceof ApiError ? error.message : 'Einstellungen konnten nicht geladen werden.'}
        </p>
      ) : (
        <>
          {data.isDemo && (
            <div>
              <h3 className="mb-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Demo-Modus</h3>
              <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
                Du nutzt aktuell die Demo-Cantina mit Beispielweinen. Starte jetzt mit deinen eigenen.
              </p>
              <StartOwnCellarSheet />
            </div>
          )}

          {data.role === 'owner' && !data.isDemo && cellarName && (
            <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
              <h3 className="mb-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--destructive)' }}>
                Gefahrenzone
              </h3>
              <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
                Entfernt alle Weine, Flaschen, Fotos, Verkostungen, Reisen und
                Lagerorte aus diesem Keller. Diese Aktion kann nicht widerrufen werden.
              </p>
              <ResetCellarSheet cellarName={cellarName} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
