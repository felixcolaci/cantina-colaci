import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCard } from '@/components/dashboard/stats-card'
import Link from 'next/link'

export default async function DashboardPage() {
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

  if (!cellar) redirect('/login')

  const { data: wines } = await admin
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  const wineIds = (wines ?? []).map(w => w.id)

  const { data: inStockEntries } = wineIds.length
    ? await admin
        .from('cellar_entries')
        .select('quantity')
        .in('wine_id', wineIds)
        .eq('status', 'in_stock')
    : { data: [] }

  const totalBottles = (inStockEntries ?? []).reduce((sum, e) => sum + e.quantity, 0)

  const { data: recentTastings } = await admin
    .from('tastings')
    .select('id, date, rating, cellar_entries(wines(name, producer))')
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Ciao, willkommen.</h2>

      <div className="grid grid-cols-2 gap-3">
        <StatsCard title="Flaschen im Keller" value={totalBottles} />
        <StatsCard title="Verschiedene Weine" value={wineIds.length} />
      </div>

      {recentTastings && recentTastings.length > 0 && (
        <section>
          <h3 className="eyebrow mb-3">Letzte Verkostungen</h3>
          <div className="space-y-2">
            {recentTastings.map(t => {
              const wine = (t.cellar_entries as any)?.wines
              return (
                <div
                  key={t.id}
                  className="flex justify-between items-center p-3 rounded-lg border"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 600,
                        lineHeight: 1.2,
                      }}
                    >
                      {wine?.name ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span
                    className="nums font-bold"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)' }}
                  >
                    {t.rating}/10
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {wineIds.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <BottleGlyph />
          <p className="mt-3">Der Keller ist noch leer.</p>
          <Link href="/wine/new" className="mt-3 inline-block text-primary underline">
            Ersten Wein hinzufügen
          </Link>
        </div>
      )}
    </div>
  )
}

function BottleGlyph() {
  return (
    <svg
      width="32" height="64" viewBox="0 0 22 56" fill="none"
      stroke="var(--clay)" strokeWidth="1.6" strokeLinejoin="round"
      aria-hidden="true" style={{ opacity: 0.5, margin: '0 auto', display: 'block' }}
    >
      <path d="M8 2h6v9c0 1.5 1 2.5 2 3.8 1.8 1.8 3 3.6 3 7.2v28a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V22c0-3.6 1.2-5.4 3-7.2 1-1.3 2-2.3 2-3.8V2Z" />
      <line x1="3.5" y1="34" x2="18.5" y2="34" />
    </svg>
  )
}
