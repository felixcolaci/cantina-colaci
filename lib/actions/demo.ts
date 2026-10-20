'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DEMO_WINES, DEMO_STORAGE_LOCATIONS, DEMO_TRIP } from '@/lib/seed/demo-data'

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

export async function clearDemoCellar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const cellarName = (formData.get('cellarName') as string) || 'Meine Cantina'

  const { data: membership, error: membershipError } = await admin
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) throw membershipError
  if (!membership) redirect('/')

  const { data: cellar, error: cellarError } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (cellarError) throw cellarError
  if (!cellar) redirect('/')

  const { data: wines, error: winesError } = await admin
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  if (winesError) throw winesError

  const wineIds = (wines ?? []).map(w => w.id)

  if (wineIds.length > 0) {
    const { data: entries, error: entriesError } = await admin
      .from('skus')
      .select('id')
      .in('wine_id', wineIds)

    if (entriesError) throw entriesError

    const entryIds = (entries ?? []).map(e => e.id)

    if (entryIds.length > 0) {
      const { error: tastingsDeleteError } = await admin
        .from('tastings').delete().in('cellar_entry_id', entryIds)
      if (tastingsDeleteError) throw tastingsDeleteError

      const { error: skusDeleteError } = await admin
        .from('skus').delete().in('id', entryIds)
      if (skusDeleteError) throw skusDeleteError
    }

    const { error: winesDeleteError } = await admin.from('wines').delete().in('id', wineIds)
    if (winesDeleteError) throw winesDeleteError
  }

  const { error: tripsDeleteError } = await admin.from('trips').delete().eq('cellar_id', cellar.id)
  if (tripsDeleteError) throw tripsDeleteError

  const { error: locationsDeleteError } = await admin
    .from('storage_locations').delete().eq('cellar_id', cellar.id)
  if (locationsDeleteError) throw locationsDeleteError

  const { error: cellarUpdateError } = await admin
    .from('cellars').update({ name: cellarName }).eq('id', cellar.id)
  if (cellarUpdateError) throw cellarUpdateError

  const { error: familyUpdateError } = await admin
    .from('families').update({ is_demo: false }).eq('id', membership.family_id)
  if (familyUpdateError) throw familyUpdateError

  redirect('/cellar')
}
