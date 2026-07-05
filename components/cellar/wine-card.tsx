import Link from 'next/link'
import Image from 'next/image'
import type { Wine, Sku } from '@/lib/types'

const TYPE_CONFIG = {
  red:      { bg: 'var(--type-red-bg)',       fg: 'var(--type-red-fg)',       dot: '#7c2d12', label: 'Rotwein' },
  white:    { bg: 'var(--type-white-bg)',      fg: 'var(--type-white-fg)',     dot: '#c9a227', label: 'Weißwein' },
  'rosé':   { bg: 'var(--type-rose-bg)',       fg: 'var(--type-rose-fg)',      dot: '#c98a8f', label: 'Rosé' },
  sparkling:{ bg: 'var(--type-sparkling-bg)',  fg: 'var(--type-sparkling-fg)', dot: '#5f8aac', label: 'Schaumwein' },
} as const

interface WineCardProps {
  wine: Wine
  skus: Pick<Sku, 'quantity' | 'photo_url'>[]
  vintage: number | null
}

export function WineCard({ wine, skus, vintage }: WineCardProps) {
  const totalBottles = skus.reduce((sum, s) => sum + s.quantity, 0)
  const photo = skus.find(s => s.photo_url)?.photo_url
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
            position: 'relative',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(160deg, var(--parchment), var(--parchment-2))',
          }}
        >
          {photo ? (
            <Image src={photo} alt={wine.name} fill sizes="64px" className="object-cover" />
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
            {vintage && (
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 500, fontStyle: 'italic' }}>
                {'  '}{vintage}
              </span>
            )}
          </span>
          <div className="flex flex-wrap gap-1.5 items-center mt-0.5">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5"
              style={{
                background: type.bg,
                color: type.fg,
                borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1,
                height: 20,
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: type.dot, flexShrink: 0,
                  boxShadow: '0 0 0 1.5px color-mix(in oklab, currentColor 18%, transparent)',
                }}
              />
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
