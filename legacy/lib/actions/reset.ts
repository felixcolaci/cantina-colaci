'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type AdminClient = ReturnType<typeof createAdminClient>

type Membership = {
  family_id: string
  role: string
  families: { name: string; is_demo: boolean } | null
}

// Matches exactly the two shapes this app ever writes into skus.photo_path
// (families/<familyId>/wines/<wineId>.<ext>, from addWine in wine.ts) or
// wine_photos.path (families/<familyId>/wines/<wineId>/<photoId>.<ext>,
// from addWinePhoto in wine-photos.ts). Every captured segment is checked
// for exact equality against the familyId/wineId already verified
// server-side (the row this path came from was fetched by filtering on
// that very wine_id), and the final filename segment is anchored so it
// can't itself contain a path separator -- so a photo_path a family member
// rewrote directly via PostgREST (RLS gates which row, not what value
// lands in it) can't smuggle a `..`/`/` segment past this into pointing at
// another family's object. isPhotoPathOwnedByFamily's looser `startsWith`
// check (used by deleteWinePhoto/clearSkuPhoto) is enough there because
// those act on a single id-addressed row the caller already named; this is
// a bulk delete across every row in the cellar being wiped, so it's pinned
// to the exact wine_id that row belongs to as well.
const SKU_PHOTO_PATH = /^families\/([^/]+)\/wines\/([^/.]+)\.[A-Za-z0-9]+$/
const WINE_PHOTO_PATH = /^families\/([^/]+)\/wines\/([^/]+)\/[A-Za-z0-9._-]+$/

function isExpectedPhotoPath(path: string, familyId: string, wineId: string): boolean {
  const sku = path.match(SKU_PHOTO_PATH)
  if (sku) return sku[1] === familyId && sku[2] === wineId
  const photo = path.match(WINE_PHOTO_PATH)
  if (photo) return photo[1] === familyId && photo[2] === wineId
  return false
}

// Resolves the caller's membership and enforces that only an owner can
// reset, and never a demo family (its wines are meant to be cleared via
// clearDemoCellar in demo.ts, which also flips is_demo off and lets the
// owner rename the cellar -- resetting here would leave is_demo stuck true
// over an otherwise-empty cellar). Mirrors the UI gating on the family and
// cellar-settings pages so the server enforces the same policy regardless
// of how the request was made.
async function requireResettableOwner(
  admin: AdminClient,
  userId: string,
  ownerErrorMessage: string,
): Promise<Membership> {
  const { data: membership, error } = await admin
    .from('family_members')
    .select('family_id, role, families(name, is_demo)')
    .eq('user_id', userId)
    .maybeSingle<Membership>()
  if (error) throw error
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') throw new Error(ownerErrorMessage)
  if (membership.families?.is_demo) {
    throw new Error('Die Demo-Cantina kann nicht zurückgesetzt werden — nutze "Eigene Cantina starten"')
  }
  return membership
}

// Wipes every wine (and its skus/tastings/photos), trip and storage location
// for one cellar, including the backing wine-photos storage objects. Leaves
// the cellar row itself untouched -- this empties a cellar, it doesn't
// remove it. Shared by resetCellar (one cellar) and resetFamily (every
// cellar in the family).
async function wipeCellarData(admin: AdminClient, cellarId: string, familyId: string) {
  const { data: wines, error: winesError } = await admin
    .from('wines').select('id').eq('cellar_id', cellarId)
  if (winesError) throw winesError

  const wineIds = (wines ?? []).map(w => w.id)

  if (wineIds.length > 0) {
    const { data: skus, error: skusError } = await admin
      .from('skus').select('id, wine_id, photo_path').in('wine_id', wineIds)
    if (skusError) throw skusError

    const { data: winePhotos, error: winePhotosError } = await admin
      .from('wine_photos').select('wine_id, path').in('wine_id', wineIds)
    if (winePhotosError) throw winePhotosError

    type PhotoCandidate = { path: string; wineId: string }

    const photoPaths: string[] = [
      ...(skus ?? [])
        .filter(s => Boolean(s.photo_path))
        .map(s => ({ path: s.photo_path as string, wineId: s.wine_id as string })),
      ...(winePhotos ?? []).map(p => ({ path: p.path as string, wineId: p.wine_id as string })),
    ]
      .filter((p: PhotoCandidate) => isExpectedPhotoPath(p.path, familyId, p.wineId))
      .map((p: PhotoCandidate) => p.path)

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
  const membership = await requireResettableOwner(
    admin, user.id, 'Nur der Owner kann den Keller zurücksetzen',
  )

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
  const membership = await requireResettableOwner(
    admin, user.id, 'Nur der Owner kann die Familie zurücksetzen',
  )

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
