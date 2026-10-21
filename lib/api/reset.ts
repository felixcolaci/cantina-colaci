import type { User } from '@supabase/supabase-js'
import type { createAdminClient } from '@/lib/supabase/server'
import { ApiAuthError } from '@/lib/api/auth'
import { BUCKET } from '@/lib/storage/wine-photos'
import type { FamilyRole } from '@/lib/types'

type AdminClient = ReturnType<typeof createAdminClient>

type Membership = {
  familyId: string
  role: FamilyRole
  familyName: string
  isDemo: boolean
}

type MembershipRow = {
  family_id: string
  role: FamilyRole
  families: { name: string; is_demo: boolean } | null
}

/**
 * Resolves the caller's membership for a destructive reset action and
 * enforces who's allowed to trigger one: only the family's owner, and
 * never over a demo family (its cellar is cleared via clearDemoCellar
 * instead, which also flips is_demo off -- resetting here would leave a
 * demo family's is_demo stuck true over an otherwise-empty cellar). Ported
 * 1:1 from legacy's requireResettableOwner (lib/actions/reset.ts).
 */
export async function requireResettableOwner(admin: AdminClient, user: User): Promise<Membership> {
  const { data } = await admin
    .from('family_members')
    .select('family_id, role, families(name, is_demo)')
    .eq('user_id', user.id)
    .maybeSingle<MembershipRow>()
  if (!data) throw new ApiAuthError('Kein Familienmitglied', 403)
  if (data.role !== 'owner') throw new ApiAuthError('Nur der Owner kann zurücksetzen', 403)
  if (data.families?.is_demo) {
    throw new ApiAuthError('Die Demo-Cantina kann nicht zurückgesetzt werden — nutze "Eigene Cantina starten"', 400)
  }
  return { familyId: data.family_id, role: data.role, familyName: data.families?.name ?? '', isDemo: false }
}

/**
 * Resolves the caller's membership for clearDemoCellar and enforces the
 * opposite gate from requireResettableOwner: owner-only, and only over an
 * actual demo family.
 */
export async function requireDemoOwner(admin: AdminClient, user: User): Promise<Membership> {
  const { data } = await admin
    .from('family_members')
    .select('family_id, role, families(name, is_demo)')
    .eq('user_id', user.id)
    .maybeSingle<MembershipRow>()
  if (!data) throw new ApiAuthError('Kein Familienmitglied', 403)
  if (data.role !== 'owner') throw new ApiAuthError('Nur der Owner kann die Demo-Cantina zurücksetzen', 403)
  if (!data.families?.is_demo) throw new ApiAuthError('Diese Cantina ist keine Demo-Cantina', 400)
  return { familyId: data.family_id, role: data.role, familyName: data.families?.name ?? '', isDemo: true }
}

/**
 * Matches exactly the two shapes this app ever writes into skus.photo_path
 * or wine_photos.path (see buildWinePhotoPath in lib/storage/wine-photos.ts
 * and addWine's inline sku path). Every captured segment is checked for
 * exact equality against the familyId/wineId already verified server-side
 * -- a bulk delete across every row in a cellar being wiped, so (unlike
 * isPhotoPathOwnedByFamily's looser startsWith check, enough for a single
 * id-addressed row) this is pinned to the exact wine_id too, so a
 * photo_path a family member rewrote directly via PostgREST can't smuggle
 * a `..`/`/` segment past this into pointing at another family's object.
 */
const SKU_PHOTO_PATH = /^families\/([^/]+)\/wines\/([^/.]+)\.[A-Za-z0-9]+$/
const WINE_PHOTO_PATH = /^families\/([^/]+)\/wines\/([^/]+)\/[A-Za-z0-9._-]+$/

function isExpectedPhotoPath(path: string, familyId: string, wineId: string): boolean {
  const sku = path.match(SKU_PHOTO_PATH)
  if (sku) return sku[1] === familyId && sku[2] === wineId
  const photo = path.match(WINE_PHOTO_PATH)
  if (photo) return photo[1] === familyId && photo[2] === wineId
  return false
}

/**
 * Wipes every wine (and its skus/tastings/photos), trip and storage
 * location for one cellar, including the backing wine-photos storage
 * objects. Leaves the cellar row itself untouched. Shared by the
 * /api/v1/cellar/reset and /api/v1/family/reset routes (one cellar vs.
 * every cellar in the family). Ported 1:1 from legacy's wipeCellarData.
 */
export async function wipeCellarData(admin: AdminClient, cellarId: string, familyId: string): Promise<void> {
  const { data: wines, error: winesError } = await admin.from('wines').select('id').eq('cellar_id', cellarId)
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
      const { error: removeError } = await admin.storage.from(BUCKET).remove(photoPaths)
      if (removeError) throw removeError
    }

    const skuIds = (skus ?? []).map(s => s.id)
    if (skuIds.length > 0) {
      const { error: tastingsDeleteError } = await admin.from('tastings').delete().in('cellar_entry_id', skuIds)
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

  const { error: locationsDeleteError } = await admin.from('storage_locations').delete().eq('cellar_id', cellarId)
  if (locationsDeleteError) throw locationsDeleteError
}

/** Validates the {confirm} body every reset/clear route takes: the caller
 * must type the exact name back, same double-confirmation UX as legacy. */
export function confirmMatches(body: unknown, expected: string): boolean {
  if (!body || typeof body !== 'object') return false
  const confirm = (body as Record<string, unknown>).confirm
  return typeof confirm === 'string' && confirm.trim() === expected
}
