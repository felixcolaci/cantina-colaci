import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WineForm } from './wine-form'
import type { WineHints } from '@/lib/types'

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))]
}

export default async function NewWinePage() {
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

  const cellarId = cellar?.id

  const [tripsResult, winesResult, wineIdsResult] = await Promise.all([
    cellarId
      ? supabase.from('trips').select('id, name').eq('cellar_id', cellarId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    cellarId
      ? supabase.from('wines').select('name, producer, grape_variety, region, country').eq('cellar_id', cellarId)
      : Promise.resolve({ data: [] }),
    cellarId
      ? supabase.from('wines').select('id').eq('cellar_id', cellarId)
      : Promise.resolve({ data: [] }),
  ])

  const wines = winesResult.data ?? []
  const wineIds = (wineIdsResult.data ?? []).map((w: { id: string }) => w.id)

  const entriesResult = wineIds.length > 0
    ? await supabase.from('cellar_entries').select('purchase_location').in('wine_id', wineIds)
    : { data: [] }

  const hints: WineHints = {
    names: distinct(wines.map((w: { name: string }) => w.name)),
    producers: distinct(wines.map((w: { producer: string }) => w.producer)),
    grapeVarieties: distinct(wines.map((w: { grape_variety: string | null }) => w.grape_variety)),
    purchaseLocations: distinct((entriesResult.data ?? []).map((e: { purchase_location: string | null }) => e.purchase_location)),
    ownRegions: distinct(wines.map((w: { region: string | null }) => w.region)),
    ownCountries: distinct(wines.map((w: { country: string | null }) => w.country)),
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 className="text-xl font-semibold mb-6">Wein hinzufügen</h2>
      <WineForm trips={tripsResult.data ?? []} hints={hints} />
    </div>
  )
}
