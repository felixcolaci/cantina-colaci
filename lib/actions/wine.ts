'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { WineType } from '@/lib/types'

async function getCellarId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return null

  const { data: cellar } = await supabase
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return cellar?.id ?? null
}

export async function addWine(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) redirect('/onboarding')

  const cellarId = await getCellarId(supabase, user.id)
  if (!cellarId) redirect('/onboarding')

  const { data: wine, error: wineError } = await supabase
    .from('wines')
    .insert({
      cellar_id: cellarId,
      name: formData.get('name') as string,
      producer: formData.get('producer') as string,
      vintage: formData.get('vintage') ? parseInt(formData.get('vintage') as string) : null,
      region: (formData.get('region') as string) || null,
      country: (formData.get('country') as string) || null,
      grape_variety: (formData.get('grape_variety') as string) || null,
      type: formData.get('type') as WineType,
      notes: (formData.get('notes') as string) || null,
    })
    .select()
    .single()

  if (wineError) throw new Error(wineError.message)

  let photo_url: string | null = null
  const photoFile = formData.get('photo') as File | null
  if (photoFile && photoFile.size > 0) {
    const ext = photoFile.name.split('.').pop() ?? 'jpg'
    const path = `families/${membership.family_id}/wines/${wine.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('wine-photos')
      .upload(path, photoFile, { contentType: photoFile.type })

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('wine-photos').getPublicUrl(path)
      photo_url = urlData.publicUrl
    }
  }

  await supabase.from('cellar_entries').insert({
    wine_id: wine.id,
    quantity: parseInt((formData.get('quantity') as string) ?? '1'),
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    purchase_date: (formData.get('purchase_date') as string) || null,
    purchase_location: (formData.get('purchase_location') as string) || null,
    shelf_location: (formData.get('shelf_location') as string) || null,
    trip_id: (formData.get('trip_id') as string) || null,
    photo_url,
    status: 'in_stock',
  })

  redirect(`/wine/${wine.id}`)
}
