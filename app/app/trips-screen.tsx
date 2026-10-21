'use client'

import { Link } from '@tanstack/react-router'
import { useTrips } from '@/lib/powersync/queries'
import { NewTripSheet } from '@/app/app/new-trip-sheet'
import { BackLink } from '@/app/app/back-link'
import { Skeleton } from '@/components/ui/skeleton'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function LocationPinGlyph() {
  // --clay doesn't exist in app/globals.css (legacy references it too but
  // never defines it); var(--muted-foreground) is the closest existing
  // token to what it was presumably meant to be.
  return (
    <svg
      width="32" height="40" viewBox="0 0 24 32" fill="none"
      stroke="var(--muted-foreground)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ opacity: 0.5, margin: '0 auto', display: 'block' }}
    >
      <path d="M12 2a7 7 0 0 1 7 7c0 4.5-7 13-7 13S5 13.5 5 9a7 7 0 0 1 7-7Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

export function TripsScreen({ cellarId }: { cellarId: string }) {
  const { trips, isLoading } = useTrips(cellarId)

  return (
    <div className="px-4 pb-6 max-w-lg mx-auto space-y-4">
      <BackLink to="/" className="pt-6">Keller</BackLink>

      <div className="flex items-center justify-between">
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--foreground)',
          margin: 0,
        }}>
          Reisen
        </h1>
        <NewTripSheet cellarId={cellarId} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
          <LocationPinGlyph />
          <p className="mt-3">Noch keine Reisen — Andiamo!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map(trip => (
            <Link
              key={trip.id}
              to="/trips/$id"
              params={{ id: trip.id }}
              className="block p-4 wine-card-hover"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {trip.location && <p className="eyebrow mb-1">{trip.location}</p>}
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--foreground)',
              }}>
                {trip.name}
              </p>
              <div className="flex items-baseline justify-between mt-1">
                {trip.dateStart && (
                  <p className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
                    {formatDate(trip.dateStart)}{trip.dateEnd ? ` → ${formatDate(trip.dateEnd)}` : ''}
                  </p>
                )}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
                  {trip.wineCount} {trip.wineCount === 1 ? 'Wein' : 'Weine'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
