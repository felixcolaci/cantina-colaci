import { createClient } from '@/lib/supabase/server'
import { getCellarContext } from '@/lib/cellar-context'
import { redirect } from 'next/navigation'
import { WineForm } from './wine-form'
import type { WineHints, StorageLocation } from '@/lib/types'

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))]
}

export default async function NewWinePage() {
  const context = await getCellarContext()
  if (!context) redirect('/login')

  const supabase = await createClient()
  const cellarId = context.cellarId

  const [tripsResult, winesResult, wineIdsResult, locationsResult] = await Promise.all([
    cellarId
      ? supabase.from('trips').select('id, name').eq('cellar_id', cellarId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    cellarId
      ? supabase.from('wines').select('name, producer, grape_variety, region, country').eq('cellar_id', cellarId)
      : Promise.resolve({ data: [] }),
    cellarId
      ? supabase.from('wines').select('id').eq('cellar_id', cellarId)
      : Promise.resolve({ data: [] }),
    cellarId
      ? supabase.from('storage_locations').select('id, name, type').eq('cellar_id', cellarId).order('name')
      : Promise.resolve({ data: [] }),
  ])

  const wines = winesResult.data ?? []
  const wineIds = (wineIdsResult.data ?? []).map((w: { id: string }) => w.id)

  const entriesResult = wineIds.length > 0
    ? await supabase.from('cellar_entries').select('purchase_location').in('wine_id', wineIds)
    : { data: [] }

  // Build a map of country → regions from user's own wines
  const ownRegionsByCountry: Record<string, string[]> = {}
  for (const wine of wines) {
    if (wine.country && wine.region) {
      if (!ownRegionsByCountry[wine.country]) ownRegionsByCountry[wine.country] = []
      if (!ownRegionsByCountry[wine.country].includes(wine.region)) {
        ownRegionsByCountry[wine.country].push(wine.region)
      }
    }
  }

  const hints: WineHints = {
    names: distinct(wines.map((w: { name: string }) => w.name)),
    producers: distinct(wines.map((w: { producer: string }) => w.producer)),
    grapeVarieties: distinct(wines.map((w: { grape_variety: string | null }) => w.grape_variety)),
    purchaseLocations: distinct((entriesResult.data ?? []).map((e: { purchase_location: string | null }) => e.purchase_location)),
    ownRegionsByCountry,
    ownCountries: distinct(wines.map((w: { country: string | null }) => w.country)),
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 className="text-xl font-semibold mb-6">Wein hinzufügen</h2>
      <WineForm
        trips={tripsResult.data ?? []}
        hints={hints}
        storageLocations={(locationsResult.data ?? []) as StorageLocation[]}
      />
    </div>
  )
}
