import Link from 'next/link'
import type { Wine, CellarEntry } from '@/lib/types'

const TYPE_CONFIG = {
  red:      { bg: 'var(--type-red-bg)',       fg: 'var(--type-red-fg)',       label: 'Rotwein' },
  white:    { bg: 'var(--type-white-bg)',      fg: 'var(--type-white-fg)',     label: 'Weißwein' },
  'rosé':   { bg: 'var(--type-rose-bg)',       fg: 'var(--type-rose-fg)',      label: 'Rosé' },
  sparkling:{ bg: 'var(--type-sparkling-bg)',  fg: 'var(--type-sparkling-fg)', label: 'Schaumwein' },
} as const

interface WineCardProps {
  wine: Wine
  entries: Pick<CellarEntry, 'quantity' | 'photo_url'>[]
}

export function WineCard({ wine, entries }: WineCardProps) {
  const totalBottles = entries.reduce((sum, e) => sum + e.quantity, 0)
  const photo = entries.find(e => e.photo_url)?.photo_url
  const type = TYPE_CONFIG[wine.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.red

  return (
    <Link href={`/wine/${wine.id}`} className="block">
      <div
        className="flex gap-4 p-4 wine-card-hover"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Photo well */}
        <div
          className="flex-none flex items-center justify-center overflow-hidden"
          style={{
            width: 64,
            minHeight: 92,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(160deg, var(--parchment), var(--parchment-2))',
          }}
        >
          {photo ? (
            <img src={photo} alt={wine.name} className="w-full h-full object-cover" />
          ) : (
            <BottleGlyph />
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          {wine.producer && (
            <span className="eyebrow truncate">{wine.producer}</span>
          )}
          <span
            className="nums"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              lineHeight: 1.12,
              color: 'var(--foreground)',
              letterSpacing: '-0.01em',
            }}
          >
            {wine.name}
            {wine.vintage && (
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 500, fontStyle: 'italic' }}>
                {'  '}{wine.vintage}
              </span>
            )}
          </span>
          <div className="flex flex-wrap gap-1.5 items-center mt-0.5">
            <span
              className="inline-flex items-center px-2 py-0.5"
              style={{
                background: type.bg,
                color: type.fg,
                borderRadius: 'var(--radius-full)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {type.label}
            </span>
          </div>
        </div>

        {/* Bottle count */}
        <div className="flex-none flex flex-col items-end justify-center gap-0.5 pl-1">
          <span
            className="nums"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              lineHeight: 1,
              color: totalBottles > 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
            }}
          >
            {totalBottles}
          </span>
          <span className="eyebrow">{totalBottles === 1 ? 'Flasche' : 'Flaschen'}</span>
        </div>
      </div>
    </Link>
  )
}

function BottleGlyph() {
  return (
    <svg
      width="22" height="56" viewBox="0 0 22 56" fill="none"
      stroke="var(--clay)" strokeWidth="1.6" strokeLinejoin="round"
      aria-hidden="true" style={{ opacity: 0.6 }}
    >
      <path d="M8 2h6v9c0 1.5 1 2.5 2 3.8 1.8 1.8 3 3.6 3 7.2v28a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V22c0-3.6 1.2-5.4 3-7.2 1-1.3 2-2.3 2-3.8V2Z" />
      <line x1="3.5" y1="34" x2="18.5" y2="34" />
    </svg>
  )
}
