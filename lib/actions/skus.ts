'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

async function resolveStorageLocation(
  admin: ReturnType<typeof createAdminClient>,
  rawId: string | null,
  cellarId: string,
): Promise<string | null> {
  if (!rawId) return null
  const { data: loc } = await admin
    .from('storage_locations').select('id')
    .eq('id', rawId).eq('cellar_id', cellarId).maybeSingle()
  if (!loc) throw new Error('Ungültiger Lagerort')
  return loc.id
}

export async function updateSku(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const id = formData.get('id') as string
  const wineId = formData.get('wine_id') as string

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) throw new Error('Kein Zugriff')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) throw new Error('Kein Keller gefunden')

  const { data: wine } = await admin
    .from('wines').select('id').eq('id', wineId).eq('cellar_id', cellar.id).maybeSingle()
  if (!wine) throw new Error('Wein nicht gefunden')

  const qty = parseInt(formData.get('quantity') as string)
  const vintageRaw = formData.get('vintage') as string
  const vintage = vintageRaw ? parseInt(vintageRaw) : null
  const storage_location_id = await resolveStorageLocation(
    admin, (formData.get('storage_location_id') as string) || null, cellar.id,
  )

  await admin.from('skus').update({
    vintage,
    quantity: qty,
    status: qty <= 0 ? 'consumed' : 'in_stock',
    storage_location_id,
    shelf_location: (formData.get('shelf_location') as string) || null,
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    purchase_date: (formData.get('purchase_date') as string) || null,
    purchase_location: (formData.get('purchase_location') as string) || null,
  }).eq('id', id).eq('wine_id', wineId)

  redirect(`/wine/${wineId}`)
}

export async function clearSkuPhoto(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const skuId = formData.get('entry_id') as string
  const wineId = formData.get('wine_id') as string

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) throw new Error('Kein Zugriff')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) throw new Error('Kein Keller')

  const { data: wine } = await admin
    .from('wines').select('id').eq('id', wineId).eq('cellar_id', cellar.id).maybeSingle()
  if (!wine) throw new Error('Wein nicht gefunden')

  await admin.from('skus')
    .update({ photo_url: null })
    .eq('id', skuId)
    .eq('wine_id', wineId)

  redirect(`/wine/${wineId}`)
}

export async function addSku(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const wineId = formData.get('wine_id') as string

  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()
  if (!membership) throw new Error('Kein Zugriff')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) throw new Error('Kein Keller gefunden')

  const { data: wine } = await admin
    .from('wines').select('id').eq('id', wineId).eq('cellar_id', cellar.id).maybeSingle()
  if (!wine) throw new Error('Wein nicht gefunden')

  const vintageRaw = formData.get('vintage') as string
  const vintage = vintageRaw ? parseInt(vintageRaw) : null
  const quantity = parseInt(formData.get('quantity') as string)
  const storage_location_id = await resolveStorageLocation(
    admin, (formData.get('storage_location_id') as string) || null, cellar.id,
  )

  await admin.from('skus').insert({
    wine_id: wineId,
    vintage,
    quantity,
    status: 'in_stock',
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    purchase_date: (formData.get('purchase_date') as string) || null,
    purchase_location: (formData.get('purchase_location') as string) || null,
    storage_location_id,
  })

  redirect(`/wine/${wineId}`)
}
