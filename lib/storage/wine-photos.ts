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

// How long a signed URL stays valid. Picked to comfortably outlive a single
// page render (including any client-side revalidation) while still
// expiring promptly if a photo is deleted/replaced.
export const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Resolves a single bare storage object path to a short-lived signed URL.
 * Returns null (after logging) on any signing failure, so a transient
 * storage error degrades to "no photo shown" rather than crashing the page.
 */
export async function signPhotoPath(
  admin: AdminClient,
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
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
 * paths are de-duped before signing. Paths that fail to sign are simply
 * omitted from the returned map (after logging), rather than throwing.
 */
export async function signPhotoPaths(
  admin: AdminClient,
  paths: string[],
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  const uniquePaths = [...new Set(paths)]
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
