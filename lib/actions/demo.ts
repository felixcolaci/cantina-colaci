'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DEMO_WINES, DEMO_STORAGE_LOCATIONS, DEMO_TRIP } from '@/lib/seed/demo-data'

export async function seedDemoCellar(userId: string): Promise<void> {
  const supabase = await createClient()

  // Create family
  const { data: family } = await supabase
    .from('families')
    .insert({ name: 'Meine Familie', created_by: userId, is_demo: true })
    .select()
    .single()

  if (!family) return

  // Add owner membership
  await supabase
    .from('family_members')
    .insert({ family_id: family.id, user_id: userId, role: 'owner' })

  // Create cellar
  const { data: cellar } = await supabase
    .from('cellars')
    .insert({ family_id: family.id, name: 'Meine Cantina' })
    .select()
    .single()

  if (!cellar) return

  // Create storage locations
  const { data: locations } = await supabase
    .from('storage_locations')
    .insert(DEMO_STORAGE_LOCATIONS.map(loc => ({ ...loc, cellar_id: cellar.id })))
    .select()

  if (!locations) return

  // Create trip
  const { data: trips } = await supabase
    .from('trips')
    .insert([{ ...DEMO_TRIP, cellar_id: cellar.id }])
    .select()

  const demoTrip = trips?.[0] ?? null

  // Create wines + entries + tastings
  for (const demoWine of DEMO_WINES) {
    const { data: wine } = await supabase
      .from('wines')
      .insert({
        cellar_id: cellar.id,
        name: demoWine.name,
        producer: demoWine.producer,
        type: demoWine.type,
        region: demoWine.region,
        country: demoWine.country,
        grape_variety: demoWine.grape_variety,
        notes: demoWine.notes,
      })
      .select()
      .single()

    if (!wine) continue

    const location = locations[demoWine.storageLocationIndex]
    const trip = demoWine.tripIndex !== null ? demoTrip : null

    // Demo photos live under demo/ in the wine-photos bucket and are shared across all
    // demo cellars — they are never deleted per user.
    const { data: photoData } = supabase.storage
      .from('wine-photos')
      .getPublicUrl(demoWine.demoPhotoPath)

    const { data: entry } = await supabase
      .from('skus')
      .insert({
        wine_id: wine.id,
        vintage: demoWine.vintage,
        quantity: demoWine.quantity,
        purchase_price: demoWine.purchase_price,
        purchase_location: demoWine.purchase_location,
        storage_location_id: location?.id ?? null,
        trip_id: trip?.id ?? null,
        photo_url: photoData.publicUrl,
        status: 'in_stock',
      })
      .select()
      .single()

    if (entry && demoWine.tasting) {
      await supabase.from('tastings').insert({
        cellar_entry_id: entry.id,
        user_id: userId,
        date: '2026-06-01',
        rating: demoWine.tasting.rating,
        notes: demoWine.tasting.notes,
      })
    }
  }
}

export async function clearDemoCellar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cellarName = (formData.get('cellarName') as string) || 'Meine Cantina'

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/')

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!cellar) redirect('/')

  const { data: wines } = await supabase
    .from('wines')
    .select('id')
    .eq('cellar_id', cellar.id)

  const wineIds = (wines ?? []).map(w => w.id)

  if (wineIds.length > 0) {
    const { data: entries } = await supabase
      .from('skus')
      .select('id')
      .in('wine_id', wineIds)

    const entryIds = (entries ?? []).map(e => e.id)

    if (entryIds.length > 0) {
      await supabase.from('tastings').delete().in('cellar_entry_id', entryIds)
      await supabase.from('skus').delete().in('id', entryIds)
    }

    await supabase.from('wines').delete().in('id', wineIds)
  }

  await supabase.from('trips').delete().eq('cellar_id', cellar.id)
  await supabase.from('storage_locations').delete().eq('cellar_id', cellar.id)

  await supabase.from('cellars').update({ name: cellarName }).eq('id', cellar.id)
  await supabase.from('families').update({ is_demo: false }).eq('id', membership.family_id)

  redirect('/cellar')
}
