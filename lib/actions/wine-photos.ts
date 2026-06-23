'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}
const MAX_BYTES = 5 * 1024 * 1024

async function verifyWineOwnership(userId: string, wineId: string) {
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('family_members').select('family_id').eq('user_id', userId).maybeSingle()
  if (!membership) throw new Error('Kein Zugriff')

  const { data: cellar } = await admin
    .from('cellars').select('id').eq('family_id', membership.family_id)
    .order('created_at').limit(1).maybeSingle()
  if (!cellar) throw new Error('Kein Keller')

  const { data: wine } = await admin
    .from('wines').select('id').eq('id', wineId).eq('cellar_id', cellar.id).maybeSingle()
  if (!wine) throw new Error('Wein nicht gefunden')

  return { admin, familyId: membership.family_id }
}

export async function addWinePhoto(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const wineId = formData.get('wine_id') as string
  const { admin, familyId } = await verifyWineOwnership(user.id, wineId)

  const file = formData.get('photo') as File | null
  if (!file || file.size === 0) throw new Error('Kein Foto ausgewählt')

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) throw new Error('Format nicht unterstützt (JPEG, PNG, WebP, HEIC)')
  if (file.size > MAX_BYTES) throw new Error('Foto zu groß (max 5 MB)')

  const photoId = crypto.randomUUID()
  const path = `families/${familyId}/wines/${wineId}/${photoId}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('wine-photos')
    .upload(path, file, { contentType: file.type })
  if (uploadError) throw new Error('Upload fehlgeschlagen')

  const { data: urlData } = admin.storage.from('wine-photos').getPublicUrl(path)

  await admin.from('wine_photos').insert({ wine_id: wineId, url: urlData.publicUrl })

  redirect(`/wine/${wineId}`)
}

export async function deleteWinePhoto(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const wineId = formData.get('wine_id') as string
  const photoId = formData.get('photo_id') as string

  const { admin } = await verifyWineOwnership(user.id, wineId)

  const { data: photo } = await admin
    .from('wine_photos').select('id, url').eq('id', photoId).eq('wine_id', wineId).maybeSingle()
  if (!photo) throw new Error('Foto nicht gefunden')

  const storagePath = new URL(photo.url).pathname.split('/wine-photos/')[1]
  if (storagePath) await admin.storage.from('wine-photos').remove([storagePath])

  await admin.from('wine_photos').delete().eq('id', photoId)

  redirect(`/wine/${wineId}`)
}
