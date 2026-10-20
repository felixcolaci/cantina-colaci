import { createAdminClient } from '@/lib/supabase/server'
import { DEMO_WINES, DEMO_STORAGE_LOCATIONS, DEMO_TRIP } from '@/lib/seed/demo-data'

// Not a 'use server' module on purpose: this performs an admin-client (service-role)
// write for an arbitrary userId with no caller-identity check of its own — it must never
// become a server-action endpoint callable from client code. The only caller is
// app/auth/callback/route.ts, which already resolved userId from its own authenticated
// session before calling this.
export async function seedDemoCellar(userId: string): Promise<void> {
  const admin = createAdminClient()

  // Create family
  const { data: family, error: familyError } = await admin
    .from('families')
    .insert({ name: 'Meine Familie', created_by: userId, is_demo: true })
    .select()
    .single()

  if (familyError) throw familyError
  if (!family) return

  // Add owner membership
  const { error: memberError } = await admin
    .from('family_members')
    .insert({ family_id: family.id, user_id: userId, role: 'owner' })

  if (memberError) throw memberError

  // Create cellar
  const { data: cellar, error: cellarError } = await admin
    .from('cellars')
    .insert({ family_id: family.id, name: 'Meine Cantina' })
    .select()
    .single()

  if (cellarError) throw cellarError
  if (!cellar) return

  // Create storage locations
  const { data: locations, error: locationsError } = await admin
    .from('storage_locations')
    .insert(DEMO_STORAGE_LOCATIONS.map(loc => ({ ...loc, cellar_id: cellar.id })))
    .select()

  if (locationsError) throw locationsError
  if (!locations) return

  // Create trip
  const { data: trips, error: tripError } = await admin
    .from('trips')
    .insert([{ ...DEMO_TRIP, cellar_id: cellar.id }])
    .select()

  if (tripError) throw tripError

  const demoTrip = trips?.[0] ?? null

  // Create all wines in one batch insert.
  const { data: wines, error: winesError } = await admin
    .from('wines')
    .insert(DEMO_WINES.map(demoWine => ({
      cellar_id: cellar.id,
      name: demoWine.name,
      producer: demoWine.producer,
      type: demoWine.type,
      region: demoWine.region,
      country: demoWine.country,
      grape_variety: demoWine.grape_variety,
      notes: demoWine.notes,
    })))
    .select()

  if (winesError) throw winesError
  if (!wines) return

  // Build the skus batch from the wines just inserted — relies on a single
  // multi-row INSERT ... RETURNING preserving the input order, which both
  // Postgres and PostgREST do.
  const { data: entries, error: entriesError } = await admin
    .from('skus')
    .insert(DEMO_WINES.map((demoWine, i) => {
      const wine = wines[i]
      const location = locations[demoWine.storageLocationIndex]
      const trip = demoWine.tripIndex !== null ? demoTrip : null

      // Demo photos live under demo/ in the wine-photos bucket and are shared across all
      // demo cellars — they are never deleted per user.
      const { data: photoData } = admin.storage
        .from('wine-photos')
        .getPublicUrl(demoWine.demoPhotoPath)

      return {
        wine_id: wine.id,
        vintage: demoWine.vintage,
        quantity: demoWine.quantity,
        purchase_price: demoWine.purchase_price,
        purchase_location: demoWine.purchase_location,
        storage_location_id: location?.id ?? null,
        trip_id: trip?.id ?? null,
        photo_url: photoData.publicUrl,
        status: 'in_stock',
      }
    }))
    .select()

  if (entriesError) throw entriesError
  if (!entries) return

  // Build the tastings batch from the skus just inserted, for wines that have one.
  const tastingRows = DEMO_WINES
    .map((demoWine, i) => ({ demoWine, entry: entries[i] }))
    .filter(({ demoWine }) => demoWine.tasting !== null)
    .map(({ demoWine, entry }) => ({
      cellar_entry_id: entry.id,
      user_id: userId,
      date: '2026-06-01',
      rating: demoWine.tasting!.rating,
      notes: demoWine.tasting!.notes,
    }))

  if (tastingRows.length > 0) {
    const { error: tastingsError } = await admin.from('tastings').insert(tastingRows)
    if (tastingsError) throw tastingsError
  }
}
