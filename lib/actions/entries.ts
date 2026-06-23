'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function updateEntry(formData: FormData) {
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

  await admin.from('cellar_entries').update({
    quantity: qty,
    status: qty <= 0 ? 'consumed' : 'in_stock',
    storage_location_id: (formData.get('storage_location_id') as string) || null,
    shelf_location: (formData.get('shelf_location') as string) || null,
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    purchase_date: (formData.get('purchase_date') as string) || null,
    purchase_location: (formData.get('purchase_location') as string) || null,
  }).eq('id', id).eq('wine_id', wineId)

  redirect(`/wine/${wineId}`)
}
