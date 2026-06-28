import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCard } from '@/components/dashboard/stats-card'
import { WineHeroCard } from '@/components/dashboard/wine-hero-card'
import { TastingCard } from '@/components/dashboard/tasting-card'
import { Button } from '@/components/ui/button'
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

  // wines first — needed for inStock count via .in()
  const { data: wines } = await admin
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  const wineIds = (wines ?? []).map(w => w.id)

  const [inStockResult, tastingsResult, latestWineResult] = await Promise.all([
    wineIds.length
      ? admin.from('cellar_entries').select('quantity').in('wine_id', wineIds).eq('status', 'in_stock')
      : Promise.resolve({ data: [] as { quantity: number }[] }),
    admin
      .from('tastings')
      .select(`
        id, date, rating, notes,
        cellar_entries!inner(
          wines!inner(name, producer, vintage, cellar_id)
        )
      `)
      .eq('cellar_entries.wines.cellar_id', cellar.id)
      .order('date', { ascending: false })
      .limit(3),
    admin
      .from('wines')
      .select('id, name, producer, vintage, type')
      .eq('cellar_id', cellar.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const wineCount = wineIds.length
  const totalBottles = (inStockResult.data ?? []).reduce((sum, e) => sum + e.quantity, 0)
  const recentTastings = tastingsResult.data ?? []
  const latestWine = latestWineResult.data

  if (!latestWine) {
    return (
      <div className="px-4 py-12 max-w-lg mx-auto text-center space-y-4">
        <BottleGlyph />
        <p style={{ color: 'var(--muted-foreground)' }}>Der Keller ist noch leer.</p>
        <Button render={<Link href="/wine/new" />}>
          Ersten Wein hinzufügen
        </Button>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <WineHeroCard wine={latestWine} />

      <div className="grid grid-cols-2 gap-3">
        <StatsCard title="Flaschen im Keller" value={totalBottles} />
        <StatsCard title="Verschiedene Weine" value={wineCount} />
      </div>

      {recentTastings.length > 0 && (
        <section>
          <p className="eyebrow mb-3">Letzte Verkostungen</p>
          <div className="space-y-3">
            {recentTastings.map(t => {
              const wine = (t.cellar_entries as any)?.wines
              if (!wine) return null
              return (
                <TastingCard
                  key={t.id}
                  tasting={{
                    id: t.id,
                    date: t.date,
                    rating: t.rating,
                    notes: t.notes,
                  }}
                  wine={{
                    name: wine.name,
                    producer: wine.producer ?? null,
                    vintage: wine.vintage ?? null,
                  }}
                />
              )
            })}
          </div>
        </section>
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
