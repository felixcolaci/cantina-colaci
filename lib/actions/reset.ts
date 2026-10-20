'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isPhotoPathOwnedByFamily } from '@/lib/storage/wine-photos'

type AdminClient = ReturnType<typeof createAdminClient>

// Wipes every wine (and its skus/tastings/photos), trip and storage location
// for one cellar, including the backing wine-photos storage objects. Leaves
// the cellar row itself untouched -- this empties a cellar, it doesn't
// remove it. Shared by resetCellar (one cellar) and resetFamily (every
// cellar in the family).
//
// photo paths are filtered through isPhotoPathOwnedByFamily before being
// handed to storage.remove(): skus.photo_path / wine_photos.path are DB
// columns a family member can reach via a direct PostgREST update to their
// own row, so a stored value isn't trustworthy on its own (same caveat as
// deleteWinePhoto/clearSkuPhoto in wine-photos.ts/skus.ts). This also means
// a demo/ path (shared across every demo cellar) is never deleted here.
async function wipeCellarData(admin: AdminClient, cellarId: string, familyId: string) {
  const { data: wines, error: winesError } = await admin
    .from('wines').select('id').eq('cellar_id', cellarId)
  if (winesError) throw winesError

  const wineIds = (wines ?? []).map(w => w.id)

  if (wineIds.length > 0) {
    const { data: skus, error: skusError } = await admin
      .from('skus').select('id, photo_path').in('wine_id', wineIds)
    if (skusError) throw skusError

    const { data: winePhotos, error: winePhotosError } = await admin
      .from('wine_photos').select('path').in('wine_id', wineIds)
    if (winePhotosError) throw winePhotosError

    const photoPaths = [
      ...(skus ?? []).map(s => s.photo_path).filter((p): p is string => Boolean(p)),
      ...(winePhotos ?? []).map(p => p.path),
    ].filter(path => isPhotoPathOwnedByFamily(path, familyId))

    if (photoPaths.length > 0) {
      const { error: removeError } = await admin.storage.from('wine-photos').remove(photoPaths)
      if (removeError) throw removeError
    }

    const skuIds = (skus ?? []).map(s => s.id)
    if (skuIds.length > 0) {
      const { error: tastingsDeleteError } = await admin
        .from('tastings').delete().in('cellar_entry_id', skuIds)
      if (tastingsDeleteError) throw tastingsDeleteError

      const { error: skusDeleteError } = await admin.from('skus').delete().in('id', skuIds)
      if (skusDeleteError) throw skusDeleteError
    }

    // wine_photos rows cascade from this delete (wine_photos.wine_id
    // references wines(id) on delete cascade, 010_wine_photos.sql).
    const { error: winesDeleteError } = await admin.from('wines').delete().in('id', wineIds)
    if (winesDeleteError) throw winesDeleteError
  }

  const { error: tripsDeleteError } = await admin.from('trips').delete().eq('cellar_id', cellarId)
  if (tripsDeleteError) throw tripsDeleteError

  const { error: locationsDeleteError } = await admin
    .from('storage_locations').delete().eq('cellar_id', cellarId)
  if (locationsDeleteError) throw locationsDeleteError
}

export async function resetCellar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership, error: membershipError } = await admin
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') throw new Error('Nur der Owner kann den Keller zurücksetzen')

  const { data: cellar, error: cellarError } = await admin
    .from('cellars')
    .select('id, name')
    .eq('family_id', membership.family_id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (cellarError) throw cellarError
  if (!cellar) redirect('/')

  const confirmText = ((formData.get('confirm') as string) ?? '').trim()
  if (confirmText !== cellar.name) {
    throw new Error('Bestätigungstext stimmt nicht mit dem Namen des Kellers überein')
  }

  await wipeCellarData(admin, cellar.id, membership.family_id)

  redirect('/cellar')
}

export async function resetFamily(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: membership, error: membershipError } = await admin
    .from('family_members')
    .select('family_id, role, families(name)')
    .eq('user_id', user.id)
    .maybeSingle<{ family_id: string; role: string; families: { name: string } | null }>()
  if (membershipError) throw membershipError
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') throw new Error('Nur der Owner kann die Familie zurücksetzen')

  const familyName = membership.families?.name ?? ''
  const confirmText = ((formData.get('confirm') as string) ?? '').trim()
  if (confirmText !== familyName) {
    throw new Error('Bestätigungstext stimmt nicht mit dem Namen der Familie überein')
  }

  const { data: cellars, error: cellarsError } = await admin
    .from('cellars')
    .select('id')
    .eq('family_id', membership.family_id)
  if (cellarsError) throw cellarsError

  for (const cellar of cellars ?? []) {
    await wipeCellarData(admin, cellar.id, membership.family_id)
  }

  redirect('/cellar')
}
