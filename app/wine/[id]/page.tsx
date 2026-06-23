import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { OpenBottleButton } from './open-bottle-button'

export default async function WineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Verify the wine belongs to the user's family before fetching anything
  const { data: membership } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!cellar) redirect('/onboarding')

  // Scope the wine query to the user's cellar — prevents IDOR
  const { data: wine } = await admin
    .from('wines')
    .select('*')
    .eq('id', id)
    .eq('cellar_id', cellar.id)
    .maybeSingle()

  if (!wine) notFound()

  const { data: entries } = await admin
    .from('cellar_entries')
    .select('*')
    .eq('wine_id', id)
    .order('created_at', { ascending: false })

  const entryIds = (entries ?? []).map(e => e.id)

  const { data: tastings } = entryIds.length
    ? await admin
        .from('tastings')
        .select('*')
        .in('cellar_entry_id', entryIds)
        .order('date', { ascending: false })
    : { data: [] }

  const inStockEntries = (entries ?? []).filter(e => e.status === 'in_stock')
  const totalBottles = inStockEntries.reduce((sum, e) => sum + e.quantity, 0)
  const photo = (entries ?? []).find(e => e.photo_url)?.photo_url

  const typeLabel: Record<string, string> = {
    red: 'Rotwein', white: 'Weißwein', rosé: 'Rosé', sparkling: 'Schaumwein',
  }

  return (
    <div className="max-w-lg mx-auto">
      {photo && (
        <img src={photo} alt={wine.name} className="w-full h-56 object-cover" />
      )}
      <div className="px-4 py-6 space-y-6">
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 700,
              letterSpacing: 'var(--tracking-tight)',
              lineHeight: 'var(--leading-snug)',
              margin: 0,
            }}
          >
            {wine.name}
          </h2>
          <p className="text-muted-foreground">{wine.producer}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {wine.vintage && <Badge variant="outline">{wine.vintage}</Badge>}
            <Badge>{typeLabel[wine.type]}</Badge>
            {wine.region && <Badge variant="secondary">{wine.region}</Badge>}
            {wine.grape_variety && <Badge variant="secondary">{wine.grape_variety}</Badge>}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted text-center">
          <p className="text-4xl font-bold">{totalBottles}</p>
          <p className="text-sm text-muted-foreground">Flaschen im Keller</p>
        </div>

        {inStockEntries.length > 0 && <OpenBottleButton entryId={inStockEntries[0].id} />}

        {wine.notes && (
          <div>
            <h3 className="font-semibold mb-1">Notizen</h3>
            <p className="text-sm text-muted-foreground">{wine.notes}</p>
          </div>
        )}

        {tastings && tastings.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Verkostungen ({tastings.length})</h3>
            <div className="space-y-2">
              {tastings.map(t => (
                <div key={t.id} className="p-3 rounded-lg border">
                  <div className="flex justify-between items-start">
                    <p className="text-sm text-muted-foreground">{t.date}</p>
                    <span className="font-bold text-lg">{t.rating}/10</span>
                  </div>
                  {t.notes && <p className="text-sm mt-1">{t.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
