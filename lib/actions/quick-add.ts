'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { WineType } from '@/lib/types'
import { getFeatureFlags } from '@/lib/flags'

export async function quickAddWine(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) redirect('/onboarding')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) redirect('/login')

  const flags = await getFeatureFlags(membership.family_id)
  if (!flags.unlimited_cellar) {
    const { count } = await admin
      .from('wines').select('*', { count: 'exact', head: true }).eq('cellar_id', cellar.id)
    if ((count ?? 0) >= 50) throw new Error('Limite raggiunto: massimo 50 vini nel piano gratuito.')
  }

  const { data: wine, error: wineError } = await admin
    .from('wines')
    .insert({
      cellar_id: cellar.id,
      name: formData.get('name') as string,
      producer: (formData.get('producer') as string) || null,
      type: formData.get('type') as WineType,
      region: null,
      country: null,
      grape_variety: null,
      notes: null,
    })
    .select()
    .single()

  if (wineError) throw new Error(wineError.message)

  const rawLocId = (formData.get('storage_location_id') as string) || null
  let storage_location_id: string | null = null
  if (rawLocId) {
    const { data: loc } = await admin
      .from('storage_locations').select('id')
      .eq('id', rawLocId).eq('cellar_id', cellar.id).maybeSingle()
    if (!loc) throw new Error('Ungültiger Lagerort')
    storage_location_id = loc.id
  }

  await admin.from('skus').insert({
    wine_id: wine.id,
    vintage: formData.get('vintage') ? parseInt(formData.get('vintage') as string) : null,
    quantity: parseInt((formData.get('quantity') as string) ?? '1'),
    storage_location_id,
    status: 'in_stock',
    purchase_price: null,
    purchase_date: null,
    purchase_location: null,
    shelf_location: null,
    trip_id: null,
    photo_url: null,
  })

  redirect('/cellar')
}
