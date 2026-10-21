// The storage bucket backing every wine photo (both real user uploads under
// families/<family_id>/wines/<wine_id>/... and the shared demo/*.jpg photos).
// It was converted from public to private in
// supabase/migrations/20261020125658_make_wine_photos_bucket_private.sql --
// the DB stores only the bare object path (never a resolved URL). Reads go
// through GET /api/v1/photos/[...path] (app/api/v1/photos/[...path]/route.ts),
// which re-derives the same ownership check below before streaming the
// bytes back; nothing here ever resolves a path to a URL anymore.
export const BUCKET = 'wine-photos'
const DEMO_PREFIX = 'demo/'

export const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/** Storage object path for a new wine photo upload -- always under the caller's
 * own family prefix, so it satisfies isPhotoPathOwnedByFamily() by construction. */
export function buildWinePhotoPath(familyId: string, wineId: string, photoId: string, ext: string): string {
  return `families/${familyId}/wines/${wineId}/${photoId}.${ext}`
}

/** Storage object path for a discovery's (at most one) photo upload. */
export function buildDiscoveryPhotoPath(familyId: string, discoveryId: string, photoId: string, ext: string): string {
  return `families/${familyId}/discoveries/${discoveryId}/${photoId}.${ext}`
}

// skus.photo_path / wine_photos.path are DB columns a family member can
// reach via a direct PostgREST update to their own row (RLS gates which
// ROWS they can touch, not what VALUE they write into this column) -- so a
// stored path is not trustworthy on its own. Every read or deletion call
// must re-verify the path actually falls under the caller's own
// families/<familyId>/ prefix (or, for reads only, the shared demo/
// prefix) before handing it to the admin/service-role client, which
// bypasses RLS entirely and will happily read or delete anything you give
// it. Never delete a demo/ path -- it's shared across every demo cellar.
export function isPhotoPathOwnedByFamily(path: string, familyId: string): boolean {
  return path.startsWith(`families/${familyId}/`)
}

export function isDemoPhotoPath(path: string): boolean {
  return path.startsWith(DEMO_PREFIX)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Every id (wineId/discoveryId/photoId) that ends up concatenated into a
 * storage path must be exactly a UUID -- never trust a URL route param or
 * client-supplied field as path-safe on its own. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

const EXT_ALTERNATION = Object.values(ALLOWED_PHOTO_TYPES).join('|')
const FAMILY_PHOTO_PATH_RE = new RegExp(
  `^families/${UUID_RE.source.slice(1, -1)}/(?:wines|discoveries)/${UUID_RE.source.slice(1, -1)}/${UUID_RE.source.slice(1, -1)}\\.(?:${EXT_ALTERNATION})$`,
  'i',
)
// Demo filenames are human-readable slugs (demo/brunello.jpg), not UUIDs --
// still closed to exactly one path segment plus an allowed extension, so no
// `..`/`/` can ever appear in a value that passes this.
const DEMO_PHOTO_PATH_RE = new RegExp(`^demo/[A-Za-z0-9_-]+\\.(?:${EXT_ALTERNATION})$`, 'i')

/**
 * Closed-shape validation (not just a prefix check) for every path this app
 * ever builds, uploads, downloads or deletes: isPhotoPathOwnedByFamily only
 * confirms the family prefix, it doesn't reject a `..` or extra `/` smuggled
 * into an id segment (e.g. via a URL route param this app never validated
 * as a UUID). Call this in addition to isPhotoPathOwnedByFamily/
 * isDemoPhotoPath wherever a path is about to be handed to the admin/
 * service-role Storage client, which bypasses RLS entirely.
 */
export function isValidPhotoPath(path: string): boolean {
  return FAMILY_PHOTO_PATH_RE.test(path) || DEMO_PHOTO_PATH_RE.test(path)
}
