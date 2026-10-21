import { Star, Coins, Clock3, Sparkles } from 'lucide-react'
import { useCellarStats } from '@/lib/powersync/queries'
import type { WineType } from '@/lib/types'

const TYPE_LABEL: Record<WineType, string> = {
  red: 'Rotwein',
  white: 'Weißwein',
  'rosé': 'Rosé',
  sparkling: 'Schaumwein',
}

const TYPE_DOT: Record<WineType, string> = {
  red: '#e29c83',
  white: '#d9b35a',
  'rosé': '#d39aa3',
  sparkling: '#8fb2cc',
}

const currency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export function CellarStatsPanel({ cellarId }: { cellarId: string }) {
  const stats = useCellarStats(cellarId)

  if (stats.isLoading) {
    return (
      <div
        className="mb-6 h-40 animate-pulse"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)' }}
      />
    )
  }

  if (stats.totalBottles === 0) {
    return (
      <div
        className="mb-6 px-5 py-6 text-center"
        style={{
          background: 'linear-gradient(160deg, var(--card), var(--secondary))',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--foreground)' }}>
          Noch leer hier unten.
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Die erste Flasche macht aus dem Keller ein Zuhause.
        </p>
      </div>
    )
  }

  return (
    <div
      className="mb-6 px-5 pt-5 pb-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, var(--card), var(--secondary))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* soft candle-glow accent in the corner -- purely decorative */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top: -60, right: -60, width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 16%, transparent), transparent 70%)',
        }}
      />

      <div className="flex items-start justify-between gap-3 relative">
        <div>
          <p className="eyebrow mb-1">Kellerstatistik</p>
          <p
            className="nums"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 700, lineHeight: 1, color: 'var(--foreground)' }}
          >
            {stats.totalBottles}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {stats.distinctWines} {stats.distinctWines === 1 ? 'Wein' : 'Weine'}
            {stats.distinctOrigins > 0 && ` · ${stats.distinctOrigins} ${stats.distinctOrigins === 1 ? 'Herkunft' : 'Herkünfte'}`}
          </p>
        </div>

        {stats.avgRating != null && (
          <div className="flex-none flex flex-col items-end">
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" style={{ color: 'var(--accent)', fill: 'var(--accent)' }} />
              <span
                className="nums"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--foreground)' }}
              >
                {stats.avgRating.toFixed(1)}
              </span>
            </div>
            <p className="eyebrow mt-0.5">{stats.ratedCount} {stats.ratedCount === 1 ? 'Verkostung' : 'Verkostungen'}</p>
          </div>
        )}
      </div>

      {stats.byType.length > 0 && (
        <div className="mt-4 relative">
          <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
            {stats.byType.map(t => (
              <div
                key={t.type}
                style={{
                  width: `${(t.bottles / stats.totalBottles) * 100}%`,
                  background: TYPE_DOT[t.type] ?? TYPE_DOT.red,
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
            {stats.byType.map(t => (
              <span key={t.type} className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_DOT[t.type] ?? TYPE_DOT.red, flexShrink: 0 }} />
                {TYPE_LABEL[t.type] ?? t.type} · {t.bottles}
              </span>
            ))}
          </div>
        </div>
      )}

      {(stats.totalValue != null || stats.oldestVintage != null) && (
        <div
          className="flex gap-5 mt-4 pt-4 relative"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {stats.totalValue != null && (
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 flex-none" style={{ color: 'var(--accent)' }} />
              <div>
                <p className="nums text-sm font-medium" style={{ color: 'var(--foreground)' }}>{currency.format(stats.totalValue)}</p>
                <p className="eyebrow">Kellerwert</p>
              </div>
            </div>
          )}
          {stats.oldestVintage != null && (
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 flex-none" style={{ color: 'var(--accent)' }} />
              <div>
                <p className="nums text-sm font-medium" style={{ color: 'var(--foreground)' }}>{stats.oldestVintage}</p>
                <p className="eyebrow">Ältester Jahrgang</p>
              </div>
            </div>
          )}
        </div>
      )}

      {stats.lastAdded && (
        <p className="flex items-center gap-1.5 mt-3 text-sm relative" style={{ color: 'var(--muted-foreground)' }}>
          <Sparkles className="h-3.5 w-3.5 flex-none" style={{ color: 'var(--accent)' }} />
          Zuletzt eingekellert:{' '}
          <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
            {stats.lastAdded.wineName}{stats.lastAdded.vintage ? ` ${stats.lastAdded.vintage}` : ''}
          </span>
        </p>
      )}
    </div>
  )
}
