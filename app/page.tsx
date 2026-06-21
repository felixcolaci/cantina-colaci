import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCard } from '@/components/dashboard/stats-card'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!cellar) redirect('/onboarding')

  const { data: wines } = await supabase
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  const wineIds = (wines ?? []).map(w => w.id)

  const { data: inStockEntries } = wineIds.length
    ? await supabase
        .from('cellar_entries')
        .select('quantity')
        .in('wine_id', wineIds)
        .eq('status', 'in_stock')
    : { data: [] }

  const totalBottles = (inStockEntries ?? []).reduce((sum, e) => sum + e.quantity, 0)

  const { data: recentTastings } = await supabase
    .from('tastings')
    .select('id, date, rating, cellar_entries(wines(name, producer))')
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Benvenuto</h2>

      <div className="grid grid-cols-2 gap-3">
        <StatsCard title="Bottiglie in cantina" value={totalBottles} />
        <StatsCard title="Vini diversi" value={wineIds.length} />
      </div>

      {recentTastings && recentTastings.length > 0 && (
        <section>
          <h3 className="font-medium mb-3">Ultime degustazioni</h3>
          <div className="space-y-2">
            {recentTastings.map(t => {
              const wine = (t.cellar_entries as any)?.wines
              return (
                <div key={t.id} className="flex justify-between items-center p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{wine?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span className="font-bold">{t.rating}/10</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {wineIds.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-4xl mb-2">🍾</p>
          <p>La cantina è vuota</p>
          <Link href="/wine/new" className="mt-3 inline-block text-primary underline">
            Aggiungi il primo vino
          </Link>
        </div>
      )}
    </div>
  )
}
