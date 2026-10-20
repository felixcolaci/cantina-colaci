import Link from 'next/link'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

type TripCardTrip = {
  id: string
  name: string
  location: string | null
  date_start: string | null
  date_end: string | null
}

export function TripCard({ trip, wineCount }: { trip: TripCardTrip; wineCount: number }) {
  const dateLabel = trip.date_start
    ? trip.date_end
      ? `${formatDate(trip.date_start)} → ${formatDate(trip.date_end)}`
      : formatDate(trip.date_start)
    : null

  return (
    <Link href={`/trips/${trip.id}`} className="block">
      <div
        className="flex gap-4 p-4 wine-card-hover"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Info block */}
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          {trip.location && (
            <span className="eyebrow truncate">{trip.location}</span>
          )}
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            color: 'var(--foreground)',
          }}>
            {trip.name}
          </span>
          {dateLabel && (
            <span className="mono" style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--muted-foreground)',
            }}>
              {dateLabel}
            </span>
          )}
        </div>

        {/* Wine count block */}
        <div className="flex-none flex flex-col items-end justify-center gap-0.5 pl-1">
          <span
            className="nums"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              lineHeight: 1,
              color: wineCount > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
            }}
          >
            {wineCount}
          </span>
          <span className="eyebrow">Weine</span>
        </div>
      </div>
    </Link>
  )
}
