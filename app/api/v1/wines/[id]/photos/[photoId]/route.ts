import { requireApiUser, apiAuthErrorResponse } from '@/lib/api/auth'
import { resolveWineFamily } from '@/lib/api/wine'
import { createAdminClient } from '@/lib/supabase/server'
import {
  BUCKET, ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, buildWinePhotoPath,
  isPhotoPathOwnedByFamily, isValidPhotoPath, isUuid,
} from '@/lib/storage/wine-photos'

// Bytes-only endpoint, targeted directly by the AttachmentQueue's remote
// transport (lib/powersync/attachment-queues.ts) -- the wine_photos
// metadata row (id, wine_id, path, ...) is a separate, independent sync
// pipeline (app/api/v1/wine_photos/[id]/route.ts, driven by the normal
// PowerSync CRUD queue). `photoId` here is the same id as that row's `id`,
// chosen client-side (AttachmentQueue.generateAttachmentId()), so both
// pipelines agree on identity without ever talking to each other.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const { id, photoId } = await params
    // id/photoId are route params a caller fully controls -- validate as
    // plain UUIDs before they ever reach a storage path, so a `..` or `/`
    // smuggled in there can't escape this family's prefix (see
    // isValidPhotoPath's doc comment).
    if (!isUuid(id) || !isUuid(photoId)) return Response.json({ error: 'Ungültige ID' }, { status: 400 })

    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const familyId = await resolveWineFamily(admin, user.id, id)

    const contentType = request.headers.get('content-type') ?? ''
    const ext = ALLOWED_PHOTO_TYPES[contentType]
    if (!ext) return Response.json({ error: 'Format nicht unterstützt (JPEG, PNG, WebP, HEIC)' }, { status: 400 })

    const body = await request.arrayBuffer()
    if (body.byteLength === 0) return Response.json({ error: 'Kein Foto übermittelt' }, { status: 400 })
    if (body.byteLength > MAX_PHOTO_BYTES) return Response.json({ error: 'Foto zu groß (max 5 MB)' }, { status: 400 })

    const path = buildWinePhotoPath(familyId, id, photoId, ext)
    if (!isValidPhotoPath(path)) return Response.json({ error: 'Ungültiger Foto-Pfad' }, { status: 400 })

    // upsert: true -- a retried upload after a dropped connection must
    // succeed, not fail with a 409 on the object that already landed.
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, body, { contentType, cacheControl: '31536000', upsert: true })
    if (error) return Response.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Storage-object removal only -- the wine_photos row's own deletion is a
// separate, independent sync op (DELETE app/api/v1/wine_photos/[id]/route.ts),
// driven by the normal PowerSync CRUD queue, not this route.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const { id, photoId } = await params
    if (!isUuid(id) || !isUuid(photoId)) return Response.json({ error: 'Ungültige ID' }, { status: 400 })

    const user = await requireApiUser(request)
    const admin = createAdminClient()
    const familyId = await resolveWineFamily(admin, user.id, id)

    const { data: photo } = await admin
      .from('wine_photos')
      .select('id, path')
      .eq('id', photoId)
      .eq('wine_id', id)
      .maybeSingle()
    if (!photo) return new Response(null, { status: 204 }) // already gone -- ok

    // path is a DB column a family member can reach via a direct PostgREST
    // update to their own row -- only ever delete a storage object that's
    // actually this family's AND matches one of this app's own path shapes.
    // An out-of-scope or malformed value just skips the storage delete.
    if (isValidPhotoPath(photo.path) && isPhotoPathOwnedByFamily(photo.path, familyId)) {
      await admin.storage.from(BUCKET).remove([photo.path])
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    return apiAuthErrorResponse(err) ?? Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
