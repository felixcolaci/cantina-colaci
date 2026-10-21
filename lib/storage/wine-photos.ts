import type { createAdminClient } from '@/lib/supabase/server'

// The storage bucket backing every wine photo (both real user uploads under
// families/<family_id>/wines/<wine_id>/... and the shared demo/*.jpg photos).
// It was converted from public to private in
// supabase/migrations/20261020125658_make_wine_photos_bucket_private.sql --
// the DB now stores only the bare object path (never a resolved URL, which
// would expire), and every render resolves it to a short-lived signed URL
// here, via the admin/service-role client. Signing bypasses RLS regardless
// of path, so a demo/* path signs exactly like a families/* path -- no
// special-casing needed.
const BUCKET = 'wine-photos'
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

// How long a signed URL stays valid. Picked to comfortably outlive a single
// page render (including any client-side revalidation) while still
// expiring promptly if a photo is deleted/replaced.
export const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

type AdminClient = ReturnType<typeof createAdminClient>

// skus.photo_path / wine_photos.path are DB columns a family member can
// reach via a direct PostgREST update to their own row (RLS gates which
// ROWS they can touch, not what VALUE they write into this column) -- so a
// stored path is not trustworthy on its own. Every signing or deletion
// call must re-verify the path actually falls under the caller's own
// families/<familyId>/ prefix (or, for reads only, the shared demo/
// prefix) before handing it to the admin/service-role client, which
// bypasses RLS entirely and will happily sign or delete anything you give
// it. Never delete a demo/ path -- it's shared across every demo cellar.
export function isPhotoPathOwnedByFamily(path: string, familyId: string): boolean {
  return path.startsWith(`families/${familyId}/`)
}

export function isDemoPhotoPath(path: string): boolean {
  return path.startsWith(DEMO_PREFIX)
}

/**
 * Resolves a single bare storage object path to a short-lived signed URL.
 * Rejects (returns null, no signing call made) any path that isn't either
 * the caller's own family's or a shared demo photo. Returns null (after
 * logging) on any signing failure too, so a transient storage error
 * degrades to "no photo shown" rather than crashing the page.
 */
export async function signPhotoPath(
  admin: AdminClient,
  path: string,
  familyId: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  if (!isPhotoPathOwnedByFamily(path, familyId) && !isDemoPhotoPath(path)) {
    console.error(`[wine-photos] refusing to sign out-of-scope path "${path}" for family ${familyId}`)
    return null
  }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, ttlSeconds)
  if (error || !data) {
    console.error(`[wine-photos] failed to sign path "${path}":`, error)
    return null
  }
  return data.signedUrl
}

/**
 * Batch-resolves many bare storage object paths to signed URLs in a single
 * request -- use this instead of N sequential signPhotoPath calls when a
 * page renders many photos at once (e.g. a cellar/trip list). Duplicate
 * paths are de-duped before signing. Any path that isn't the caller's own
 * family's or a shared demo photo is silently dropped before signing (same
 * ownership check as signPhotoPath). Paths that fail to sign are simply
 * omitted from the returned map (after logging), rather than throwing.
 */
export async function signPhotoPaths(
  admin: AdminClient,
  paths: string[],
  familyId: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  const uniquePaths = [...new Set(paths)].filter(path => {
    const allowed = isPhotoPathOwnedByFamily(path, familyId) || isDemoPhotoPath(path)
    if (!allowed) {
      console.error(`[wine-photos] refusing to sign out-of-scope path "${path}" for family ${familyId}`)
    }
    return allowed
  })
  if (uniquePaths.length === 0) return result

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(uniquePaths, ttlSeconds)
  if (error || !data) {
    console.error('[wine-photos] failed to batch-sign paths:', error)
    return result
  }

  for (const entry of data) {
    if (!entry.error && entry.path && entry.signedUrl) {
      result.set(entry.path, entry.signedUrl)
    } else if (entry.error) {
      console.error(`[wine-photos] failed to sign path "${entry.path}":`, entry.error)
    }
  }

  return result
}
