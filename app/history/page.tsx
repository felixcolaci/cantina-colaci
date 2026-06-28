import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/login')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: tastings } = cellar
    ? await admin
        .from('tastings')
        .select(`
          id, date, rating, notes,
          cellar_entries!inner(
            wine_id,
            wines!inner(name, producer, vintage, type, cellar_id)
          )
        `)
        .eq('cellar_entries.wines.cellar_id', cellar.id)
        .order('date', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-3xl)',
        fontWeight: 600,
        letterSpacing: 'var(--tracking-tight)',
        lineHeight: 'var(--leading-snug)',
        color: 'var(--foreground)',
        margin: 0,
      }}>
        Kellerchronik
      </h1>

      {tastings && tastings.length > 0 ? (
        <div className="space-y-3">
          {tastings.map(tasting => {
            const wine = (tasting.cellar_entries as any)?.wines
            if (!wine) return null

            return (
              <div
                key={tasting.id}
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
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>/10</span>
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
          })}
        </div>
      ) : (
        <p className="text-center py-10" style={{ color: 'var(--muted-foreground)' }}>
          Noch keine Verkostungen — apri una bottiglia!
        </p>
      )}
    </div>
  )
}
