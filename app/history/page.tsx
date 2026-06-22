import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

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
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const { data: wines } = cellar
    ? await admin.from('wines').select('id').eq('cellar_id', cellar.id)
    : { data: [] }

  const wineIds = (wines ?? []).map(w => w.id)

  const { data: entries } = wineIds.length
    ? await admin
        .from('cellar_entries')
        .select(`
          id, status, created_at,
          wine:wines(name, producer, vintage, type),
          tastings(id, date, rating, notes)
        `)
        .in('wine_id', wineIds)
        .in('status', ['consumed', 'gifted'])
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Geschichte</h2>

      {entries && entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map(entry => {
            const wine = entry.wine as any
            const tastings = (entry.tastings ?? []) as any[]
            const avgRating = tastings.length
              ? (tastings.reduce((s: number, t: any) => s + t.rating, 0) / tastings.length).toFixed(1)
              : null

            return (
              <div key={entry.id} className="p-4 rounded-lg border space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{wine?.name}</p>
                    <p className="text-sm text-muted-foreground">{wine?.producer}</p>
                  </div>
                  {avgRating && <span className="text-xl font-bold">{avgRating}/10</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {wine?.vintage && <Badge variant="outline">{wine.vintage}</Badge>}
                  <Badge variant={entry.status === 'consumed' ? 'default' : 'secondary'}>
                    {entry.status === 'consumed' ? 'Getrunken' : 'Verschenkt'}
                  </Badge>
                </div>
                {tastings.map((t: any) =>
                  t.notes ? (
                    <p key={t.id} className="text-sm text-muted-foreground italic">"{t.notes}"</p>
                  ) : null
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-center py-8 text-muted-foreground">
          Noch nichts getrunken — apri una bottiglia! 🍷
        </p>
      )}
    </div>
  )
}
