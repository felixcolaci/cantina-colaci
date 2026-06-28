import Link from 'next/link'

type WineHeroProps = {
  id: string
  name: string
  producer: string | null
  vintage: number | null
  type: 'red' | 'white' | 'rosé' | 'sparkling'
}

const TYPE_CONFIG = {
  red: {
    label: 'Rotwein',
    dot: '#7c2d12',
    bg: 'var(--type-red-bg)',
    fg: 'var(--type-red-fg)',
    hero: 'linear-gradient(160deg, #5b1e22 0%, #3d1417 55%, #2d1008 100%)',
  },
  white: {
    label: 'Weißwein',
    dot: '#c9a227',
    bg: 'var(--type-white-bg)',
    fg: 'var(--type-white-fg)',
    hero: 'linear-gradient(160deg, #9a7611 0%, #6b520d 55%, #4a3908 100%)',
  },
  rosé: {
    label: 'Rosé',
    dot: '#c98a8f',
    bg: 'var(--type-rose-bg)',
    fg: 'var(--type-rose-fg)',
    hero: 'linear-gradient(160deg, #b06a72 0%, #7a3a40 55%, #3a1417 100%)',
  },
  sparkling: {
    label: 'Schaumwein',
    dot: '#5f8aac',
    bg: 'var(--type-sparkling-bg)',
    fg: 'var(--type-sparkling-fg)',
    hero: 'linear-gradient(160deg, #4f7390 0%, #2d4d64 55%, #1a2d3d 100%)',
  },
} as const

export function WineHeroCard({ wine }: { wine: WineHeroProps }) {
  const conf = TYPE_CONFIG[wine.type] ?? TYPE_CONFIG.red

  return (
    <Link
      href={`/wine/${wine.id}`}
      className="block relative overflow-hidden"
      style={{
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        minHeight: 180,
        background: conf.hero,
      }}
    >
      {/* Text overlay gradient */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)',
        }}
      />

      {/* Type badge — top right */}
      <div
        className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1"
        style={{
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)',
          borderRadius: 'var(--radius-full)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.9)',
          lineHeight: 1,
          height: 25,
        }}
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: conf.dot, flexShrink: 0,
          }}
        />
        {conf.label}
      </div>

      {/* Content — bottom left */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        {wine.producer && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.65)',
            marginBottom: 3,
          }}>
            {wine.producer}
          </p>
        )}
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.4rem, 5vw, 1.8rem)',
          fontWeight: 700,
          color: 'white',
          lineHeight: 1.05,
          letterSpacing: 'var(--tracking-tight)',
          margin: 0,
        }}>
          {wine.name}
          {wine.vintage && (
            <span style={{ fontStyle: 'italic', fontWeight: 500, opacity: 0.75, fontSize: '0.8em' }}>
              {' '}{wine.vintage}
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}
