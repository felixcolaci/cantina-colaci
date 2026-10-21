import { requireApiUserFromCookie, apiAuthErrorResponse, ApiAuthError } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/server'
import {
  BUCKET, ALLOWED_PHOTO_TYPES, isPhotoPathOwnedByFamily, isDemoPhotoPath, isValidPhotoPath,
} from '@/lib/storage/wine-photos'

const EXT_TO_MIME = Object.fromEntries(
  Object.entries(ALLOWED_PHOTO_TYPES).map(([mime, ext]) => [ext, mime]),
)

type CellarContextRow = { family_id: string; cellar_id: string | null }

// Stable, token-free photo endpoint: the storage path itself is the
// identifier, so the same URL always serves the same bytes -- unlike the
// signed URLs this replaces, it can be cached forever (see sw.ts's
// photo-cache rule). Loaded by plain <img>/<Image> tags, which never carry
// an Authorization header, so it authenticates from the session cookie
// (requireApiUserFromCookie) instead of the bearer-token convention every
// other /api/v1/* route uses.
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const user = await requireApiUserFromCookie()
    const { path: segments } = await params
    const path = segments.join('/')

    const admin = createAdminClient()
    const { data: ctx } = await admin
      .rpc('get_cellar_context', { p_user_id: user.id })
      .maybeSingle<CellarContextRow>()
    if (!ctx?.cellar_id) throw new ApiAuthError('Kein Keller gefunden', 403)

    // isPhotoPathOwnedByFamily/isDemoPhotoPath only check the family
    // prefix -- isValidPhotoPath additionally rejects anything that isn't
    // exactly one of this app's own path shapes (closed charset per
    // segment), so a `..`/extra `/` smuggled into a route param can never
    // reach the service-role Storage client below.
    if (!isValidPhotoPath(path) || (!isPhotoPathOwnedByFamily(path, ctx.family_id) && !isDemoPhotoPath(path))) {
      return Response.json({ error: 'Nicht gefunden' }, { status: 403 })
    }

    const { data: blob, error } = await admin.storage.from(BUCKET).download(path)
    if (error || !blob) return Response.json({ error: 'Foto nicht gefunden' }, { status: 404 })

    const ext = path.split('.').pop() ?? ''
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream'

    return new Response(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
