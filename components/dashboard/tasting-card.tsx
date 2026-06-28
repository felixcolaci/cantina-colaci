export type TastingCardTasting = {
  id: string
  date: string
  rating: number
  notes: string | null
}

export type TastingCardWine = {
  name: string
  producer: string | null
  vintage: number | null
}

export function TastingCard({
  tasting,
  wine,
}: {
  tasting: TastingCardTasting
  wine: TastingCardWine
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {wine.producer && (
            <p className="eyebrow truncate mb-0.5">{wine.producer}</p>
          )}
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            color: 'var(--foreground)',
          }}>
            {wine.name}
            {wine.vintage && (
              <span className="nums" style={{ color: 'var(--muted-foreground)', fontWeight: 500, fontStyle: 'italic' }}>
                {' '}{wine.vintage}
              </span>
            )}
          </p>
          <p className="mono mt-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
            {new Date(tasting.date).toLocaleDateString('de-DE', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>

        <div className="flex-none text-right">
          <span className="nums" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--primary)',
          }}>
            {tasting.rating}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>/5</span>
        </div>
      </div>

      {tasting.notes && (
        <>
          <hr className="rule-gold my-3" />
          <p style={{
            fontSize: 'var(--text-sm)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--ink-700)',
            fontStyle: 'italic',
          }}>
            {tasting.notes}
          </p>
        </>
      )}
    </div>
  )
}
