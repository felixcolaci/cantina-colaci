import { createAdminClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
import { redirect } from 'next/navigation'
import { StatsCard } from '@/components/dashboard/stats-card'
import { WineHeroCard } from '@/components/dashboard/wine-hero-card'
import { TastingCard } from '@/components/dashboard/tasting-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function DashboardPage() {
  const context = await getCellarContext()
  if (!context || !context.cellarId) redirect('/login')
  const { cellarId } = context

  const admin = createAdminClient()

  // wines first — needed for inStock count via .in()
  const { data: wines } = await admin
    .from('wines')
    .select('id')
    .eq('cellar_id', cellarId)

  const wineIds = (wines ?? []).map(w => w.id)

  const [inStockResult, tastingsResult, latestWineResult] = await Promise.all([
    wineIds.length
      ? admin.from('skus').select('quantity').in('wine_id', wineIds).eq('status', 'in_stock')
      : Promise.resolve({ data: [] as { quantity: number }[] }),
    admin
      .from('tastings')
      .select(`
        id, date, rating, notes,
        skus!inner(
          vintage, wine_id,
          wines!inner(name, producer, cellar_id)
        )
      `)
      .eq('skus.wines.cellar_id', cellarId)
      .order('date', { ascending: false })
      .limit(3),
    admin
      .from('wines')
      .select('id, name, producer, type, skus(vintage)')
      .eq('cellar_id', cellarId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const wineCount = wineIds.length
  const totalBottles = (inStockResult.data ?? []).reduce((sum, e) => sum + e.quantity, 0)
  const recentTastings = tastingsResult.data ?? []
  const latestWineRaw = latestWineResult.data
  const latestWine = latestWineRaw
    ? {
        ...latestWineRaw,
        vintage: (latestWineRaw.skus as any)?.[0]?.vintage ?? null,
      }
    : null

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
        <StatsCard title="Flaschen im Keller" value={totalBottles} href="/cellar" />
        <StatsCard title="Verschiedene Weine" value={wineCount} href="/cellar" />
      </div>

      {recentTastings.length > 0 && (
        <section>
          <p className="eyebrow mb-3">Letzte Verkostungen</p>
          <div className="space-y-3">
            {recentTastings.map(t => {
              const sku = t.skus as any
              const wine = sku?.wines
              if (!wine) return null
              const wineId = sku?.wine_id
              return (
                <Link key={t.id} href={`/wine/${wineId}`} className="block">
                  <TastingCard
                    tasting={{
                      id: t.id,
                      date: t.date,
                      rating: t.rating,
                      notes: t.notes,
                    }}
                    wine={{
                      name: wine.name,
                      producer: wine.producer ?? null,
                      vintage: sku?.vintage ?? null,
                    }}
                  />
                </Link>
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
