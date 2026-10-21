'use client'

import { Link } from '@tanstack/react-router'
import { useTripDetail } from '@/lib/powersync/queries'
import { WineCard, BottleGlyph } from '@/components/cellar/wine-card'
import { BackLink } from '@/app/app/back-link'
import { Skeleton } from '@/components/ui/skeleton'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function StatTile({ title, value }: { title: string; value: string | number }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-4) var(--space-5)',
      }}
    >
      <p className="eyebrow mb-2">{title}</p>
      <p
        className="nums"
        style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 700, lineHeight: 1, color: 'var(--foreground)' }}
      >
        {value}
      </p>
    </div>
  )
}

export function TripDetailScreen({ tripId }: { tripId: string }) {
  const { trip, wines, stats, isLoading } = useTripDetail(tripId)

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Reise nicht gefunden.</p>
        <Link to="/trips" className="text-sm underline" style={{ color: 'var(--primary)' }}>Zurück zu Reisen</Link>
      </div>
    )
  }

  const dateLabel = trip.dateStart
    ? trip.dateEnd ? `${formatDate(trip.dateStart)} → ${formatDate(trip.dateEnd)}` : formatDate(trip.dateStart)
    : null

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <BackLink to="/trips">Reisen</BackLink>

      <div>
        {trip.location && <p className="eyebrow mb-1">{trip.location}</p>}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--foreground)',
          margin: 0,
        }}>
          {trip.name}
        </h1>
        {dateLabel && (
          <p className="mono mt-1" style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)' }}>{dateLabel}</p>
        )}
      </div>

      <div className={`grid gap-3 ${stats.totalSpend !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <StatTile title="Flaschen" value={stats.totalBottles} />
        <StatTile title="Ø Bewertung" value={stats.avgRating != null ? stats.avgRating.toFixed(1) : '—'} />
        {stats.totalSpend !== null && (
          <StatTile
            title="Ausgaben"
            value={new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(stats.totalSpend)}
          />
        )}
      </div>

      <section>
        <p className="eyebrow mb-3">Weine ({wines.length})</p>
        {wines.length > 0 ? (
          <div className="space-y-2">
            {wines.map(wine => (
              <WineCard key={wine.id} wine={wine} totalBottles={wine.totalBottles} vintage={wine.vintage} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
            <BottleGlyph width={28} height={56} opacity={0.4} />
            <p className="mt-3 text-sm">Noch keine Weine auf dieser Reise.</p>
          </div>
        )}
      </section>

      <div className="h-2" />
    </div>
  )
}
