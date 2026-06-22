'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { WineType } from '@/lib/types'

export async function addWine(formData: FormData) {
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
  if (!cellar) redirect('/onboarding')

  const { data: wine, error: wineError } = await admin
    .from('wines')
    .insert({
      cellar_id: cellar.id,
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

  const ALLOWED_IMAGE_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  }
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024

  let photo_url: string | null = null
  const photoFile = formData.get('photo') as File | null
  if (photoFile && photoFile.size > 0) {
    const ext = ALLOWED_IMAGE_TYPES[photoFile.type]
    if (!ext) throw new Error('Unsupported image type')
    if (photoFile.size > MAX_PHOTO_BYTES) throw new Error('Image too large')
    const path = `families/${membership.family_id}/wines/${wine.id}.${ext}`
    const { error: uploadError } = await admin.storage
      .from('wine-photos')
      .upload(path, photoFile, { contentType: photoFile.type })

    if (!uploadError) {
      const { data: urlData } = admin.storage.from('wine-photos').getPublicUrl(path)
      photo_url = urlData.publicUrl
    }
  }

  const tripId = (formData.get('trip_id') as string) || null
  if (tripId) {
    const { data: trip } = await admin
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .eq('cellar_id', cellar.id)
      .maybeSingle()
    if (!trip) throw new Error('Invalid trip')
  }

  await admin.from('cellar_entries').insert({
    wine_id: wine.id,
    quantity: parseInt((formData.get('quantity') as string) ?? '1'),
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    purchase_date: (formData.get('purchase_date') as string) || null,
    purchase_location: (formData.get('purchase_location') as string) || null,
    shelf_location: (formData.get('shelf_location') as string) || null,
    trip_id: tripId,
    photo_url,
    status: 'in_stock',
  })

  redirect(`/wine/${wine.id}`)
}
