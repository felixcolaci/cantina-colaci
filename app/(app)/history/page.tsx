import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TastingCard } from '@/components/dashboard/tasting-card'

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
          skus!inner(
            vintage, wine_id,
            wines!inner(id, name, producer, cellar_id)
          )
        `)
        .eq('skus.wines.cellar_id', cellar.id)
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
            const sku = tasting.skus as any
            const wine = sku?.wines
            if (!wine) return null
            const wineId = sku?.wine_id ?? wine.id
            return (
              <Link key={tasting.id} href={`/wine/${wineId}`} className="block">
                <TastingCard
                  tasting={{
                    id: tasting.id,
                    date: tasting.date,
                    rating: tasting.rating,
                    notes: tasting.notes,
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
      ) : (
        <p className="text-center py-10" style={{ color: 'var(--muted-foreground)' }}>
          Noch keine Verkostungen — apri una bottiglia!
        </p>
      )}
    </div>
  )
}
